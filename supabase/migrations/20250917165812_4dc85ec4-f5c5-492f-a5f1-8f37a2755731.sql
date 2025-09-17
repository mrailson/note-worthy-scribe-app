-- Drop and recreate log_complaint_activity function with proper search_path
DROP FUNCTION IF EXISTS public.log_complaint_activity(uuid,text,text,jsonb,jsonb);

-- Recreate with proper search_path
CREATE OR REPLACE FUNCTION public.log_complaint_activity(
  p_complaint_id uuid,
  p_action text,
  p_description text,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.complaint_audit_log (
    complaint_id,
    action,
    details,
    performed_by,
    performed_at
  ) VALUES (
    p_complaint_id,
    p_action,
    jsonb_build_object(
      'description', p_description,
      'old_values', p_old_values,
      'new_values', p_new_values
    ),
    auth.uid(),
    now()
  );
END;
$function$;

-- Fix remaining functions with search_path issues

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Fix set_data_retention_date function
CREATE OR REPLACE FUNCTION public.set_data_retention_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
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

-- Fix audit_involved_parties_changes function
CREATE OR REPLACE FUNCTION public.audit_involved_parties_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_complaint_activity(
      NEW.complaint_id,
      'involved_party_added',
      'Staff member added to complaint: ' || NEW.staff_name || ' (' || COALESCE(NEW.staff_role, 'Role not specified') || ')',
      NULL,
      jsonb_build_object(
        'staff_name', NEW.staff_name,
        'staff_email', NEW.staff_email,
        'staff_role', NEW.staff_role
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.response_submitted_at IS NULL AND NEW.response_submitted_at IS NOT NULL THEN
      PERFORM public.log_complaint_activity(
        NEW.complaint_id,
        'staff_response_submitted',
        'Response submitted by: ' || NEW.staff_name,
        NULL,
        jsonb_build_object(
          'staff_name', NEW.staff_name,
          'response_submitted_at', NEW.response_submitted_at
        )
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Fix audit_acknowledgement_changes function
CREATE OR REPLACE FUNCTION public.audit_acknowledgement_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_complaint_activity(
      NEW.complaint_id,
      'acknowledgement_sent',
      'Acknowledgement letter sent',
      NULL,
      jsonb_build_object(
        'sent_at', NEW.sent_at,
        'sent_by', NEW.sent_by
      )
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;