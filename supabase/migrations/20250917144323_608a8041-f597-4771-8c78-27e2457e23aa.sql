-- Create a function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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
$$;

-- Clean up existing expired sessions
SELECT public.cleanup_expired_sessions();

-- Create a more comprehensive session cleanup function for admin use
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions(days_old INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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
$$;