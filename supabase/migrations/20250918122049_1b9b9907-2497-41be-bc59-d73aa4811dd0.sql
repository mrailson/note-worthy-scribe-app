-- Fix function search path security issue for update_session_activity
-- Set immutable search path to empty string and ensure all objects are schema-qualified

CREATE OR REPLACE FUNCTION public.update_session_activity(p_user_id uuid, p_session_id text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  UPDATE public.user_sessions 
  SET last_activity = NOW()
  WHERE 
    user_id = p_user_id 
    AND is_active = true
    AND (p_session_id IS NULL OR session_id = p_session_id);
END;
$function$;