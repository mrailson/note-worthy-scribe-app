-- Try to fix some remaining system-level functions we might have missed

-- Fix any remaining utility and system functions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  session_timeout_minutes INTEGER;
  expired_count INTEGER;
BEGIN
  -- Get session timeout setting (default to 30 minutes if not set)
  SELECT setting_value::INTEGER INTO session_timeout_minutes
  FROM public.security_settings 
  WHERE setting_name = 'session_timeout_minutes' AND is_active = true;
  
  IF session_timeout_minutes IS NULL THEN
    session_timeout_minutes := 30;
  END IF;
  
  -- Mark expired sessions as inactive
  UPDATE public.user_sessions 
  SET 
    is_active = false, 
    logout_time = COALESCE(logout_time, NOW()),
    logout_reason = COALESCE(logout_reason, 'timeout')
  WHERE 
    is_active = true 
    AND last_activity < (NOW() - (session_timeout_minutes || ' minutes')::INTERVAL);
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_sessions(days_old integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Only system admins can run this
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Access denied. System admin privileges required.';
  END IF;
  
  -- Mark very old active sessions as inactive
  UPDATE public.user_sessions 
  SET 
    is_active = false, 
    logout_time = COALESCE(logout_time, last_activity + INTERVAL '30 minutes'),
    logout_reason = COALESCE(logout_reason, 'expired')
  WHERE 
    is_active = true 
    AND last_activity < (NOW() - (days_old || ' days')::INTERVAL);
    
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  RETURN cleaned_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_large_files_stats()
RETURNS TABLE(files_over_1mb bigint, files_500kb_to_1mb bigint, total_large_files bigint, total_large_files_size bigint, total_large_files_size_pretty text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  over_1mb_count bigint := 0;
  between_500kb_1mb_count bigint := 0;
  total_count bigint := 0;
  total_size bigint := 0;
  temp_over_1mb bigint;
  temp_between bigint;
  temp_total bigint;
  temp_size bigint;
BEGIN
  -- Files from meeting_documents
  SELECT 
    COUNT(*) FILTER (WHERE md.file_size >= 1048576),  -- over 1MB
    COUNT(*) FILTER (WHERE md.file_size >= 512000 AND md.file_size < 1048576),  -- 500KB-1MB
    COUNT(*),
    COALESCE(SUM(md.file_size), 0)
  INTO over_1mb_count, between_500kb_1mb_count, total_count, total_size
  FROM meeting_documents md;
  
  -- Files from meeting_audio_backups
  SELECT 
    COUNT(*) FILTER (WHERE mab.file_size >= 1048576),
    COUNT(*) FILTER (WHERE mab.file_size >= 512000 AND mab.file_size < 1048576),
    COUNT(*),
    COALESCE(SUM(mab.file_size), 0)
  INTO temp_over_1mb, temp_between, temp_total, temp_size
  FROM meeting_audio_backups mab;
  
  over_1mb_count := over_1mb_count + temp_over_1mb;
  between_500kb_1mb_count := between_500kb_1mb_count + temp_between;
  total_count := total_count + temp_total;
  total_size := total_size + temp_size;
  
  -- Files from complaint_investigation_evidence
  SELECT 
    COUNT(*) FILTER (WHERE cie.file_size >= 1048576),
    COUNT(*) FILTER (WHERE cie.file_size >= 512000 AND cie.file_size < 1048576),
    COUNT(*),
    COALESCE(SUM(cie.file_size), 0)
  INTO temp_over_1mb, temp_between, temp_total, temp_size
  FROM complaint_investigation_evidence cie;
  
  over_1mb_count := over_1mb_count + temp_over_1mb;
  between_500kb_1mb_count := between_500kb_1mb_count + temp_between;
  total_count := total_count + temp_total;
  total_size := total_size + temp_size;
  
  -- Files from contractor_resumes
  SELECT 
    COUNT(*) FILTER (WHERE cr.file_size >= 1048576),
    COUNT(*) FILTER (WHERE cr.file_size >= 512000 AND cr.file_size < 1048576),
    COUNT(*),
    COALESCE(SUM(cr.file_size), 0)
  INTO temp_over_1mb, temp_between, temp_total, temp_size
  FROM contractor_resumes cr;
  
  over_1mb_count := over_1mb_count + temp_over_1mb;
  between_500kb_1mb_count := between_500kb_1mb_count + temp_between;
  total_count := total_count + temp_total;
  total_size := total_size + temp_size;
  
  -- Files from cqc_evidence
  SELECT 
    COUNT(*) FILTER (WHERE ce.file_size >= 1048576),
    COUNT(*) FILTER (WHERE ce.file_size >= 512000 AND ce.file_size < 1048576),
    COUNT(*),
    COALESCE(SUM(ce.file_size), 0)
  INTO temp_over_1mb, temp_between, temp_total, temp_size
  FROM cqc_evidence ce;
  
  over_1mb_count := over_1mb_count + temp_over_1mb;
  between_500kb_1mb_count := between_500kb_1mb_count + temp_between;
  total_count := total_count + temp_total;
  total_size := total_size + temp_size;
  
  RETURN QUERY SELECT 
    over_1mb_count,
    between_500kb_1mb_count,
    total_count,
    total_size,
    pg_size_pretty(total_size);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_input_security(input_text text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Check for potential SQL injection patterns
  IF input_text ~* '(drop|delete|insert|update|alter|create|exec|execute|script|javascript|<script|onload|onerror)' THEN
    -- Log security event
    INSERT INTO public.security_events (
      event_type,
      severity,
      user_id,
      user_email,
      event_details
    ) VALUES (
      'MALICIOUS_INPUT_DETECTED',
      'high',
      auth.uid(),
      auth.email(),
      jsonb_build_object(
        'input_text', left(input_text, 100),
        'timestamp', now(),
        'detection_rule', 'sql_injection_keywords'
      )
    );
    
    RETURN false;
  END IF;
  
  -- Check for excessively long input (potential buffer overflow)
  IF length(input_text) > 10000 THEN
    INSERT INTO public.security_events (
      event_type,
      severity,
      user_id,
      user_email,
      event_details
    ) VALUES (
      'SUSPICIOUS_INPUT_LENGTH',
      'medium',
      auth.uid(),
      auth.email(),
      jsonb_build_object(
        'input_length', length(input_text),
        'timestamp', now()
      )
    );
    
    RETURN false;
  END IF;
  
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_security_event(event_type text, event_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Insert security event
    INSERT INTO public.security_events (event_type, event_details)
    VALUES (event_type, event_data);
END;
$function$;

-- Fix any remaining trigger functions that might have been missed
CREATE OR REPLACE FUNCTION public.monitor_user_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_session_count INTEGER;
  max_concurrent_sessions INTEGER := 5;
BEGIN
  -- Count current active sessions for this user
  SELECT COUNT(*) INTO current_session_count
  FROM public.user_sessions
  WHERE user_id = NEW.user_id 
    AND is_active = true
    AND last_activity > (NOW() - interval '1 hour');
  
  -- If too many concurrent sessions, log security event
  IF current_session_count > max_concurrent_sessions THEN
    INSERT INTO public.security_events (
      event_type,
      severity,
      user_id,
      user_email,
      event_details
    ) VALUES (
      'EXCESSIVE_CONCURRENT_SESSIONS',
      'high',
      NEW.user_id,
      auth.email(),
      jsonb_build_object(
        'concurrent_sessions', current_session_count,
        'max_allowed', max_concurrent_sessions,
        'timestamp', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_meeting_shares_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Update any pending shares for this email
  UPDATE public.meeting_shares 
  SET shared_with_user_id = NEW.id
  WHERE shared_with_email = NEW.email 
  AND shared_with_user_id IS NULL;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_gp_practices_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Prevent users from granting themselves system_admin role
  IF NEW.role = 'system_admin' AND NEW.user_id = auth.uid() THEN
    -- Only allow if the current user is already a system admin
    IF NOT is_system_admin() THEN
      RAISE EXCEPTION 'Users cannot grant themselves system administrator privileges';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;