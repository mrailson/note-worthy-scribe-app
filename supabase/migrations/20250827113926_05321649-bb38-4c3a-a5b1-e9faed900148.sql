-- Phase 1: Critical Database Security Fixes

-- Fix 1: Drop the insecure accessible_meetings view that uses auth functions with SECURITY DEFINER behavior
DROP VIEW IF EXISTS public.accessible_meetings;

-- Fix 2: Update SECURITY DEFINER functions to include proper search path to prevent function hijacking
-- Update log_security_event function (the overloaded version)
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

-- Update update_medical_corrections_updated_at function
CREATE OR REPLACE FUNCTION public.update_medical_corrections_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
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

-- Update update_gp_practices_updated_at function
CREATE OR REPLACE FUNCTION public.update_gp_practices_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update all other SECURITY DEFINER functions with proper search path
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Prevent users from granting themselves system_admin role
  IF NEW.role = 'system_admin' AND NEW.user_id = auth.uid() THEN
    -- Only allow if the current user is already a system admin
    IF NOT is_system_admin() THEN
      RAISE EXCEPTION 'Users cannot grant themselves system administrator privileges';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update audit_role_changes function
CREATE OR REPLACE FUNCTION public.audit_role_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Log role changes for security monitoring
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_system_activity(
      'user_roles',
      'ROLE_ASSIGNED',
      NEW.user_id,
      NULL,
      jsonb_build_object('role', NEW.role, 'practice_id', NEW.practice_id, 'assigned_by', NEW.assigned_by)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_system_activity(
      'user_roles',
      'ROLE_UPDATED', 
      NEW.user_id,
      jsonb_build_object('role', OLD.role, 'practice_id', OLD.practice_id),
      jsonb_build_object('role', NEW.role, 'practice_id', NEW.practice_id, 'updated_by', auth.uid())
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_system_activity(
      'user_roles',
      'ROLE_REMOVED',
      OLD.user_id,
      jsonb_build_object('role', OLD.role, 'practice_id', OLD.practice_id),
      jsonb_build_object('removed_by', auth.uid())
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Fix 3: Tighten RLS policies for sensitive tables
-- Add more restrictive policy for clinical_verification_tests
DROP POLICY IF EXISTS "Users can view clinical verification tests" ON public.clinical_verification_tests;
CREATE POLICY "System admins can view clinical verification tests"
ON public.clinical_verification_tests
FOR SELECT
USING (is_system_admin(auth.uid()));

-- Add audit logging trigger for security events table
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