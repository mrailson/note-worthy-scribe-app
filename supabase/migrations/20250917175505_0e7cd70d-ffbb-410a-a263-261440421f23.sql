-- Continue fixing the remaining function search path issues

-- Fix the remaining trigger and system functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_system_activity(p_table_name text, p_operation text, p_record_id uuid DEFAULT NULL::uuid, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  log_id UUID;
  user_practice_id UUID;
  current_user_id UUID;
BEGIN
  -- Get current user, default to null if not available
  current_user_id := auth.uid();
  
  -- Only try to get practice if we have a valid user
  IF current_user_id IS NOT NULL THEN
    SELECT practice_id INTO user_practice_id
    FROM public.user_roles
    WHERE user_id = current_user_id
    LIMIT 1;
  END IF;

  -- Insert audit log entry only if we have a valid user
  IF current_user_id IS NOT NULL THEN
    INSERT INTO public.system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      user_email,
      practice_id,
      old_values,
      new_values,
      timestamp
    ) VALUES (
      p_table_name,
      p_operation,
      p_record_id,
      current_user_id,
      auth.email(),
      user_practice_id,
      p_old_values,
      p_new_values,
      now()
    ) RETURNING id INTO log_id;
  ELSE
    -- Generate a dummy UUID if no user context
    log_id := gen_random_uuid();
  END IF;
  
  RETURN log_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_meeting(meeting_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

CREATE OR REPLACE FUNCTION public.set_data_retention_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  retention_days INTEGER;
BEGIN
  -- Get retention period for this table
  SELECT retention_period_days INTO retention_days
  FROM public.data_retention_policies
  WHERE table_name = TG_TABLE_NAME;
  
  -- Set retention date if policy exists
  IF retention_days IS NOT NULL THEN
    NEW.data_retention_date = NOW() + (retention_days || ' days')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_stuck_meetings()
RETURNS TABLE(fixed_meetings_count integer, fixed_meeting_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  fixed_count integer := 0;
  meeting_ids uuid[];
BEGIN
  -- Find and fix meetings stuck in recording status but have content
  UPDATE meetings 
  SET 
    status = 'completed',
    end_time = COALESCE(end_time, updated_at, created_at + INTERVAL '2 hours'),
    updated_at = now()
  WHERE status = 'recording' 
    AND (
      word_count > 0 
      OR notes_generation_status = 'completed'
      OR created_at < now() - INTERVAL '4 hours' -- recordings older than 4 hours
    )
  RETURNING id INTO meeting_ids;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  -- Log the cleanup operation
  IF fixed_count > 0 THEN
    PERFORM log_system_activity(
      'meetings',
      'AUTO_CLEANUP_STUCK_RECORDINGS',
      NULL,
      jsonb_build_object(
        'fixed_count', fixed_count,
        'meeting_ids', meeting_ids,
        'cleanup_time', now()
      ),
      NULL
    );
  END IF;
  
  RETURN QUERY SELECT fixed_count, meeting_ids;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_user_module(p_user_id uuid, p_module app_module, p_granted_by uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  module_id UUID;
BEGIN
  -- Insert or update module access
  INSERT INTO public.user_modules (user_id, module, enabled, granted_by)
  VALUES (p_user_id, p_module, true, p_granted_by)
  ON CONFLICT (user_id, module) 
  DO UPDATE SET 
    enabled = true,
    granted_by = p_granted_by,
    updated_at = now()
  RETURNING id INTO module_id;
  
  -- Log the module grant
  PERFORM public.log_system_activity(
    'user_modules',
    'MODULE_GRANTED',
    p_user_id,
    NULL,
    jsonb_build_object(
      'module', p_module,
      'granted_by', p_granted_by
    )
  );
  
  RETURN module_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_transcript_integrity(p_meeting_id uuid)
RETURNS TABLE(issue_type text, severity text, description text, metadata jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

CREATE OR REPLACE FUNCTION public.emergency_detect_transcript_data_loss()
RETURNS TABLE(meeting_id uuid, user_id uuid, meeting_title text, word_count integer, chunk_count bigint, created_at timestamp with time zone, severity text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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