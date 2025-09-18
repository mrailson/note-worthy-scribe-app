-- Fix remaining function search path security issues
-- Set immutable search path to empty string for all remaining functions

-- Fix mark_session_inactive function
CREATE OR REPLACE FUNCTION public.mark_session_inactive(p_user_id uuid, p_session_id text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
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
$function$;

-- Fix cleanup_expired_sessions function
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
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
$function$;