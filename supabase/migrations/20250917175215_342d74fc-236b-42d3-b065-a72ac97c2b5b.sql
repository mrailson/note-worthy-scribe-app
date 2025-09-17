-- Fix missing search_path on overloaded log_security_event function
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_severity text DEFAULT 'medium'::text,
  p_user_id uuid DEFAULT NULL::uuid,
  p_user_email text DEFAULT NULL::text,
  p_ip_address inet DEFAULT NULL::inet,
  p_user_agent text DEFAULT NULL::text,
  p_event_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.security_events (
    event_type,
    severity,
    user_id,
    user_email,
    ip_address,
    user_agent,
    event_details
  ) VALUES (
    p_event_type,
    p_severity,
    p_user_id,
    p_user_email,
    p_ip_address,
    p_user_agent,
    p_event_details
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$function$;