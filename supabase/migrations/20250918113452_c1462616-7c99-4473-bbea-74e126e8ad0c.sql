-- Update the cleanup_expired_sessions function to mark sessions inactive after 5 hours
-- and create function to mark session inactive on logout

-- Update cleanup function to use 5 hours (300 minutes) instead of default 30 minutes
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  session_timeout_minutes INTEGER := 300; -- 5 hours = 300 minutes
  expired_count INTEGER;
BEGIN
  -- Mark expired sessions as inactive (5 hours of inactivity)
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

-- Create function to mark user session as inactive on logout
CREATE OR REPLACE FUNCTION public.mark_session_inactive(p_user_id uuid, p_session_id text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.user_sessions 
  SET 
    is_active = false,
    logout_time = NOW(),
    logout_reason = 'user_logout'
  WHERE 
    user_id = p_user_id 
    AND is_active = true
    AND (p_session_id IS NULL OR session_id = p_session_id);
END;
$$;

-- Create function to update session activity (for tracking active sessions)
CREATE OR REPLACE FUNCTION public.update_session_activity(p_user_id uuid, p_session_id text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.user_sessions 
  SET last_activity = NOW()
  WHERE 
    user_id = p_user_id 
    AND is_active = true
    AND (p_session_id IS NULL OR session_id = p_session_id);
END;
$$;