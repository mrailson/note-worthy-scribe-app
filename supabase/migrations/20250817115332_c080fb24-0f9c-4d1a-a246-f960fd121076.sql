-- Fix critical security issues identified in security scan

-- 1. Fix search_path vulnerability in database functions by adding proper SET clauses
-- This prevents SQL injection via search path manipulation

-- Update log_security_event function (the overloaded one without proper search_path)
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

-- Update auto_generate_incident_reference function
CREATE OR REPLACE FUNCTION public.auto_generate_incident_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.incident_reference IS NULL OR NEW.incident_reference = '' THEN
    NEW.incident_reference = generate_incident_reference();
  END IF;
  RETURN NEW;
END;
$function$;

-- Update update_meeting_shares_on_signup function
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

-- Update set_data_retention_date function
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

-- Update notify_security_event function  
CREATE OR REPLACE FUNCTION public.notify_security_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
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

-- Update generate_complaint_reference function
CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  reference TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the next sequence number for this year
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.complaints
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  reference := 'CP' || year_part || LPAD(sequence_num::TEXT, 5, '0');
  
  RETURN reference;
END;
$function$;

-- Update generate_incident_reference function
CREATE OR REPLACE FUNCTION public.generate_incident_reference()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  reference TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the next sequence number for this year
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.supplier_incidents
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  reference := 'SI' || year_part || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN reference;
END;
$function$;