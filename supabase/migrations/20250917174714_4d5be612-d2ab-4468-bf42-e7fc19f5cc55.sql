-- Phase: Recreate functions with explicit search_path to satisfy linter

-- 1) get_meeting_full_transcript
CREATE OR REPLACE FUNCTION public.get_meeting_full_transcript(p_meeting_id uuid)
RETURNS TABLE(source text, transcript text, item_count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_transcript text;
  v_source text;
  v_count int;
  v_meeting_user_id uuid;
BEGIN
  -- Get the meeting owner's user_id for authorization
  SELECT user_id INTO v_meeting_user_id
  FROM public.meetings
  WHERE id = p_meeting_id;
  
  -- Check if user has access to this meeting (owner or shared access)
  IF v_meeting_user_id IS NULL THEN
    RETURN QUERY SELECT 'error'::text, 'Meeting not found'::text, 0;
    RETURN;
  END IF;
  
  -- Only check authorization if we have an authenticated user
  IF auth.uid() IS NOT NULL AND NOT (
    v_meeting_user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.meeting_shares ms
      JOIN auth.users u ON u.id = auth.uid()
      WHERE ms.meeting_id = p_meeting_id 
      AND (ms.shared_with_user_id = auth.uid() OR ms.shared_with_email = u.email)
    )
  ) THEN
    RETURN QUERY SELECT 'error'::text, 'Access denied'::text, 0;
    RETURN;
  END IF;

  -- 1) Latest session in meeting_transcription_chunks for this meeting
  SELECT
    string_agg(mtc.transcription_text, ' ' ORDER BY mtc.chunk_number) AS txt,
    'meeting_transcription_chunks' AS src,
    count(*) AS cnt
  INTO v_transcript, v_source, v_count
  FROM public.meeting_transcription_chunks mtc
  WHERE mtc.meeting_id = p_meeting_id
    AND mtc.user_id = v_meeting_user_id
    AND mtc.session_id = (
      SELECT mtc2.session_id
      FROM public.meeting_transcription_chunks mtc2
      WHERE mtc2.meeting_id = p_meeting_id
        AND mtc2.user_id = v_meeting_user_id
      GROUP BY mtc2.session_id
      ORDER BY max(mtc2.created_at) DESC, count(*) DESC
      LIMIT 1
    );

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 2) Concatenated meeting_transcripts (for the meeting owner)
  SELECT
    string_agg(mt.content, E'\n\n' ORDER BY mt.created_at) AS txt,
    'meeting_transcripts' AS src,
    count(*) AS cnt
  INTO v_transcript, v_source, v_count
  FROM public.meeting_transcripts mt
  WHERE mt.meeting_id = p_meeting_id
    AND mt.meeting_id IN (SELECT id FROM public.meetings WHERE user_id = v_meeting_user_id);

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 3) Legacy transcription_chunks (for the meeting owner)
  SELECT
    string_agg(tc.transcript_text, ' ' ORDER BY tc.chunk_number) AS txt,
    'transcription_chunks' AS src,
    count(*) AS cnt
  INTO v_transcript, v_source, v_count
  FROM public.transcription_chunks tc
  WHERE tc.meeting_id = p_meeting_id
    AND tc.meeting_id IN (SELECT id FROM public.meetings WHERE user_id = v_meeting_user_id);

  RETURN QUERY SELECT v_source, COALESCE(v_transcript, ''), COALESCE(v_count, 0);
END;
$function$;

-- 2) user_has_meeting_access
CREATE OR REPLACE FUNCTION public.user_has_meeting_access(p_meeting_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

-- 3) get_combined_transcript
CREATE OR REPLACE FUNCTION public.get_combined_transcript(p_meeting_id uuid, p_session_id text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT string_agg(transcription_text, ' ' ORDER BY chunk_number)
  FROM public.meeting_transcription_chunks
  WHERE meeting_id = p_meeting_id 
    AND session_id = p_session_id
    AND user_id = auth.uid();
$function$;

-- 4) get_meeting_transcript
CREATE OR REPLACE FUNCTION public.get_meeting_transcript(p_meeting_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT string_agg(transcript_text, ' ' ORDER BY chunk_number)
  FROM public.transcription_chunks
  WHERE meeting_id = p_meeting_id
    AND meeting_id IN (
      SELECT id FROM public.meetings WHERE user_id = auth.uid()
    );
$function$;

-- 5) get_pcn_manager_practice_ids
CREATE OR REPLACE FUNCTION public.get_pcn_manager_practice_ids(_user_id uuid DEFAULT auth.uid())
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT ARRAY_AGG(practice_id)
  FROM public.pcn_manager_practices
  WHERE user_id = _user_id;
$function$;

-- 6) is_pcn_manager_for_practice
CREATE OR REPLACE FUNCTION public.is_pcn_manager_for_practice(_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.pcn_manager_practices
    WHERE user_id = _user_id
      AND practice_id = _practice_id
  );
$function$;

-- 7) log_complaint_action
CREATE OR REPLACE FUNCTION public.log_complaint_action(p_complaint_id uuid, p_action text, p_details jsonb DEFAULT NULL::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.complaint_audit_log (complaint_id, action, details, performed_by)
  VALUES (p_complaint_id, p_action, p_details, auth.uid())
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$;

-- 8) set_complaint_due_dates
CREATE OR REPLACE FUNCTION public.set_complaint_due_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Set acknowledgement due date (3 working days)
  -- Set response due date (20 working days)
  IF NEW.status = 'submitted' AND (OLD IS NULL OR OLD.status != 'submitted') THEN
    NEW.submitted_at = NOW();
    NEW.response_due_date = NOW() + INTERVAL '20 days';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 9) update_chunk_word_count
CREATE OR REPLACE FUNCTION public.update_chunk_word_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
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

-- 10) validate_meeting_transcript_save
CREATE OR REPLACE FUNCTION public.validate_meeting_transcript_save()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
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

-- 11) protect_system_admin_updates
CREATE OR REPLACE FUNCTION public.protect_system_admin_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Prevent changing system_admin role to something else
  IF OLD.role = 'system_admin' AND NEW.role != 'system_admin' THEN
    -- Log the attempt
    INSERT INTO public.system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      user_email,
      old_values,
      new_values
    ) VALUES (
      'user_roles',
      'BLOCKED_SYSTEM_ADMIN_ROLE_CHANGE',
      OLD.id,
      COALESCE(auth.uid(), OLD.user_id),
      COALESCE(auth.email(), 'system'),
      row_to_json(OLD),
      row_to_json(NEW)
    );
    
    RAISE EXCEPTION 'Cannot change system_admin role. System administrators are protected from role changes.';
  END IF;
  
  -- Prevent assigning practice_id to system_admin roles
  IF NEW.role = 'system_admin' AND NEW.practice_id IS NOT NULL THEN
    NEW.practice_id = NULL;
    
    -- Log the correction
    INSERT INTO public.system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      user_email,
      old_values,
      new_values
    ) VALUES (
      'user_roles',
      'CORRECTED_SYSTEM_ADMIN_PRACTICE_ID',
      NEW.id,
      COALESCE(auth.uid(), NEW.user_id),
      COALESCE(auth.email(), 'system'),
      jsonb_build_object('attempted_practice_id', NEW.practice_id),
      jsonb_build_object('corrected_practice_id', NULL)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;