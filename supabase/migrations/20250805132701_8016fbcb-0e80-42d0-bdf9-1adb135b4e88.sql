-- Fix security issue in notify_security_event function
-- Add SECURITY DEFINER and set empty search path to prevent search path attacks
CREATE OR REPLACE FUNCTION public.notify_security_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Set search_path to empty string to prevent search path attacks
  SET search_path = '';
  
  -- Only log high and critical severity events to system audit
  IF NEW.severity IN ('high', 'critical') THEN
    INSERT INTO public.system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      user_email,
      new_values,
      ip_address
    ) VALUES (
      'security_events',
      'SECURITY_ALERT',
      NEW.id,
      NEW.user_id,
      NEW.user_email,
      row_to_json(NEW),
      NEW.ip_address
    );
  END IF;
  
  RETURN NEW;
END;
$function$;