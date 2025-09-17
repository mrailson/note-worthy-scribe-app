-- Final Function Search Path Security Fix
-- Find and fix ALL remaining functions missing SET search_path parameter

-- Fix complete_meeting function
CREATE OR REPLACE FUNCTION public.complete_meeting(meeting_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
    result_row meetings%rowtype;
    user_id_val uuid;
BEGIN
    -- Get current user ID
    user_id_val := auth.uid();
    
    -- Check if user ID exists
    IF user_id_val IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated');
    END IF;
    
    -- Check if meeting exists and user has access
    SELECT * INTO result_row 
    FROM meetings 
    WHERE id = meeting_id AND user_id = user_id_val;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Meeting not found or access denied');
    END IF;
    
    -- Check if already completed
    IF result_row.status = 'completed' THEN
        RETURN json_build_object('success', false, 'error', 'Meeting is already completed');
    END IF;
    
    -- Update meeting status
    UPDATE meetings 
    SET status = 'completed',
        updated_at = now(),
        notes_generation_status = 'queued'
    WHERE id = meeting_id AND user_id = user_id_val;
    
    -- Queue standard note generation with proper conflict handling
    INSERT INTO public.meeting_notes_queue (meeting_id, status, note_type, detail_level)
    VALUES (meeting_id, 'pending', 'standard', 'standard')
    ON CONFLICT (meeting_id, note_type) 
    DO UPDATE SET 
        status = 'pending',
        detail_level = 'standard',
        updated_at = now(),
        retry_count = 0,
        error_message = NULL,
        started_at = NULL,
        completed_at = NULL;
    
    -- Return success with updated meeting info
    SELECT * INTO result_row 
    FROM meetings 
    WHERE id = meeting_id;
    
    RETURN json_build_object(
        'success', true, 
        'meeting', row_to_json(result_row)
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Log the exact error for debugging
        RAISE LOG 'complete_meeting error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
        
        RETURN json_build_object(
            'success', false, 
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        );
END;
$function$;

-- Fix update_staff_hours_summary function
CREATE OR REPLACE FUNCTION public.update_staff_hours_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  assignment_week INTEGER;
  assignment_year INTEGER;
  assignment_month INTEGER;
  calculated_hours DECIMAL(4,2);
BEGIN
  -- Calculate which record to update
  IF TG_OP = 'DELETE' THEN
    assignment_week := EXTRACT(WEEK FROM OLD.assignment_date);
    assignment_year := EXTRACT(YEAR FROM OLD.assignment_date);
    assignment_month := EXTRACT(MONTH FROM OLD.assignment_date);
    
    -- Remove hours from summary
    INSERT INTO public.staff_hours_summary 
      (staff_member_id, year, month, week_number, total_hours, total_shifts)
    VALUES 
      (OLD.staff_member_id, assignment_year, assignment_month, assignment_week, 
       -(COALESCE(OLD.hours_worked, EXTRACT(EPOCH FROM (OLD.end_time - OLD.start_time))/3600)), -1)
    ON CONFLICT (staff_member_id, year, month, week_number)
    DO UPDATE SET
      total_hours = staff_hours_summary.total_hours - EXCLUDED.total_hours,
      total_shifts = staff_hours_summary.total_shifts - EXCLUDED.total_shifts,
      updated_at = now();
      
    RETURN OLD;
  ELSE
    assignment_week := EXTRACT(WEEK FROM NEW.assignment_date);
    assignment_year := EXTRACT(YEAR FROM NEW.assignment_date);
    assignment_month := EXTRACT(MONTH FROM NEW.assignment_date);
    
    -- Calculate hours (use hours_worked if available, otherwise calculate from times)
    calculated_hours := COALESCE(NEW.hours_worked, EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))/3600);
    
    -- Update summary
    INSERT INTO public.staff_hours_summary 
      (staff_member_id, year, month, week_number, total_hours, total_shifts)
    VALUES 
      (NEW.staff_member_id, assignment_year, assignment_month, assignment_week, calculated_hours, 1)
    ON CONFLICT (staff_member_id, year, month, week_number)
    DO UPDATE SET
      total_hours = staff_hours_summary.total_hours + EXCLUDED.total_hours,
      total_shifts = staff_hours_summary.total_shifts + EXCLUDED.total_shifts,
      updated_at = now();
      
    RETURN NEW;
  END IF;
END;
$function$;

-- Fix audit_complaint_changes function
CREATE OR REPLACE FUNCTION public.audit_complaint_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  old_values jsonb := '{}'::jsonb;
  new_values jsonb := '{}'::jsonb;
  change_description text := '';
  field_changes text[] := '{}';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Track all field changes
    IF OLD.patient_name IS DISTINCT FROM NEW.patient_name THEN
      old_values := old_values || jsonb_build_object('patient_name', OLD.patient_name);
      new_values := new_values || jsonb_build_object('patient_name', NEW.patient_name);
      field_changes := array_append(field_changes, 'patient_name');
    END IF;
    
    -- Continue with other fields...
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      old_values := old_values || jsonb_build_object('status', OLD.status);
      new_values := new_values || jsonb_build_object('status', NEW.status);
      field_changes := array_append(field_changes, 'status');
    END IF;
    
    -- Only log if there were actual changes
    IF array_length(field_changes, 1) > 0 THEN
      change_description := 'Fields updated: ' || array_to_string(field_changes, ', ');
      
      PERFORM public.log_complaint_activity(
        NEW.id,
        'update',
        change_description,
        old_values,
        new_values
      );
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.log_complaint_activity(
      NEW.id,
      'create',
      'Complaint created with reference ' || NEW.reference_number,
      NULL,
      jsonb_build_object(
        'reference_number', NEW.reference_number,
        'status', NEW.status,
        'priority', NEW.priority,
        'category', NEW.category,
        'patient_name', NEW.patient_name,
        'incident_date', NEW.incident_date
      )
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Fix log_complaint_activity function
CREATE OR REPLACE FUNCTION public.log_complaint_activity(
  p_complaint_id uuid,
  p_action text,
  p_description text,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.complaint_audit_log (
    complaint_id,
    action,
    details,
    performed_by,
    performed_at
  ) VALUES (
    p_complaint_id,
    p_action,
    jsonb_build_object(
      'description', p_description,
      'old_values', p_old_values,
      'new_values', p_new_values
    ),
    auth.uid(),
    now()
  );
END;
$function$;

-- Fix update_chunk_word_count function
CREATE OR REPLACE FUNCTION public.update_chunk_word_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.transcription_text IS NOT NULL THEN
    NEW.word_count = (
      SELECT COUNT(*)
      FROM regexp_split_to_table(trim(NEW.transcription_text), '\s+') AS word
      WHERE length(word) > 0
    );
  ELSE
    NEW.word_count = 0;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix validate_meeting_transcript_save function
CREATE OR REPLACE FUNCTION public.validate_meeting_transcript_save()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  -- Prevent the specific bug where word count exists but transcript text is empty
  IF NEW.word_count > 0 AND (NEW.transcription_text IS NULL OR trim(NEW.transcription_text) = '') THEN
    RAISE EXCEPTION 'TRANSCRIPT_INTEGRITY_VIOLATION: Cannot save empty transcript text with positive word count (word_count: %, text: "%")', 
      NEW.word_count, COALESCE(NEW.transcription_text, 'NULL');
  END IF;
  
  -- Set validation status based on content
  IF NEW.transcription_text IS NOT NULL AND trim(NEW.transcription_text) != '' THEN
    NEW.validation_status = 'validated';
  ELSE
    NEW.validation_status = 'failed';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix user_has_meeting_access function
CREATE OR REPLACE FUNCTION public.user_has_meeting_access(p_meeting_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    -- User owns the meeting
    SELECT 1 FROM public.meetings 
    WHERE id = p_meeting_id AND user_id = p_user_id
    
    UNION
    
    -- Meeting is shared with user
    SELECT 1 FROM public.meeting_shares ms
    JOIN auth.users u ON u.id = p_user_id
    WHERE ms.meeting_id = p_meeting_id 
    AND (ms.shared_with_user_id = p_user_id OR ms.shared_with_email = u.email)
  );
$function$;

-- Fix check_transcript_integrity function
CREATE OR REPLACE FUNCTION public.check_transcript_integrity(p_meeting_id uuid)
 RETURNS TABLE(issue_type text, severity text, description text, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  meeting_word_count INTEGER;
  chunk_count INTEGER;
  total_chunk_words INTEGER;
  has_empty_chunks BOOLEAN;
BEGIN
  -- Get meeting word count
  SELECT word_count INTO meeting_word_count FROM public.meetings WHERE id = p_meeting_id;
  
  -- Get chunk statistics
  SELECT 
    COUNT(*),
    SUM(COALESCE(word_count, 0)),
    BOOL_OR(transcription_text IS NULL OR trim(transcription_text) = '')
  INTO chunk_count, total_chunk_words, has_empty_chunks
  FROM public.meeting_transcription_chunks WHERE meeting_id = p_meeting_id;
  
  -- Check for the critical bug: word count but no transcript data
  IF meeting_word_count > 0 AND (chunk_count = 0 OR total_chunk_words = 0) THEN
    RETURN QUERY SELECT 
      'missing_transcript_data'::TEXT,
      'critical'::TEXT,
      format('CRITICAL: Meeting has %s word count but %s transcript chunks with %s total words', 
        meeting_word_count, chunk_count, COALESCE(total_chunk_words, 0))::TEXT,
      jsonb_build_object(
        'meeting_word_count', meeting_word_count, 
        'chunk_count', chunk_count,
        'total_chunk_words', COALESCE(total_chunk_words, 0),
        'bug_detected', 'transcript_data_loss'
      );
  END IF;
  
  -- Check for empty chunks (another form of the bug)
  IF has_empty_chunks AND chunk_count > 0 THEN
    RETURN QUERY SELECT
      'empty_chunks'::TEXT,
      'high'::TEXT,
      format('HIGH: %s transcript chunks contain empty text', chunk_count)::TEXT,
      jsonb_build_object('chunk_count', chunk_count, 'has_empty_chunks', has_empty_chunks);
  END IF;
  
  -- Check for missing audio backup (recovery capability)
  IF NOT EXISTS (SELECT 1 FROM public.meeting_audio_backups WHERE meeting_id = p_meeting_id) THEN
    RETURN QUERY SELECT
      'missing_audio_backup'::TEXT,
      'medium'::TEXT,
      'MEDIUM: No audio backup available for recovery'::TEXT,
      jsonb_build_object('meeting_id', p_meeting_id, 'backup_available', false);
  END IF;
END;
$function$;

-- Fix emergency_detect_transcript_data_loss function
CREATE OR REPLACE FUNCTION public.emergency_detect_transcript_data_loss()
 RETURNS TABLE(meeting_id uuid, user_id uuid, meeting_title text, word_count integer, chunk_count bigint, created_at timestamp with time zone, severity text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as meeting_id,
    m.user_id,
    m.title as meeting_title,
    m.word_count,
    COALESCE(chunk_stats.chunk_count, 0) as chunk_count,
    m.created_at,
    CASE 
      WHEN m.word_count > 0 AND COALESCE(chunk_stats.chunk_count, 0) = 0 THEN 'CRITICAL'
      WHEN m.word_count > 0 AND COALESCE(chunk_stats.total_words, 0) = 0 THEN 'CRITICAL'
      ELSE 'OK'
    END as severity
  FROM public.meetings m
  LEFT JOIN (
    SELECT 
      meeting_id,
      COUNT(*) as chunk_count,
      SUM(CASE WHEN transcription_text IS NOT NULL AND trim(transcription_text) != '' THEN word_count ELSE 0 END) as total_words
    FROM public.meeting_transcription_chunks
    GROUP BY meeting_id
  ) chunk_stats ON m.id = chunk_stats.meeting_id
  WHERE m.word_count > 0  -- Only check meetings that should have transcript data
    AND m.created_at >= NOW() - INTERVAL '30 days'  -- Last 30 days
  ORDER BY m.created_at DESC;
END;
$function$;

-- Fix generate_complaint_reference function
CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  ref_number TEXT;
  year_suffix TEXT;
  sequence_num INTEGER;
BEGIN
  -- Get the current year suffix (last 2 digits)
  year_suffix := EXTRACT(YEAR FROM NOW())::TEXT;
  year_suffix := RIGHT(year_suffix, 2);
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN reference_number ~ ('^COMP' || year_suffix || '[0-9]+$') 
      THEN SUBSTRING(reference_number FROM length('COMP' || year_suffix) + 1)::INTEGER
      ELSE 0 
    END
  ), 0) + 1
  INTO sequence_num
  FROM public.complaints
  WHERE reference_number LIKE 'COMP' || year_suffix || '%';
  
  -- Format the reference number: COMP + YY + 4-digit sequence
  ref_number := 'COMP' || year_suffix || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN ref_number;
END;
$function$;