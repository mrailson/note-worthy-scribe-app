-- Fix remaining function search path security issues

-- Update all functions that are missing SET search_path = ''
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_data_retention_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.notify_security_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;