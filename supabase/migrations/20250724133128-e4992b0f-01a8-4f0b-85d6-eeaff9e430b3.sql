-- Fix search path security issues in functions
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp';

CREATE OR REPLACE FUNCTION public.validate_nhs_email(email_address text)
RETURNS boolean AS $$
BEGIN
  RETURN email_address ~* '^[^@]+@(nhs\.net|nhs\.uk|nhft\.nhs\.uk)$';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO 'public', 'pg_temp';