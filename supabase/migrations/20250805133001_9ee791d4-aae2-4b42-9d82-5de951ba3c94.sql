-- Fix log_security_event function with secure search path
CREATE OR REPLACE FUNCTION public.log_security_event(
    event_type text,
    event_data jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    -- Set search path to empty string for security
    SET search_path = '';
    
    -- Insert security event
    INSERT INTO public.security_events (event_type, event_details)
    VALUES (event_type, event_data);
END;
$function$;