-- Fix critical security issues in user_roles table

-- Add audit trigger for role changes
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role change auditing
DROP TRIGGER IF EXISTS audit_user_role_changes ON public.user_roles;
CREATE TRIGGER audit_user_role_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();

-- Add function to validate email domains server-side
CREATE OR REPLACE FUNCTION public.validate_nhs_email(email_address text)
RETURNS boolean AS $$
BEGIN
  RETURN email_address ~* '^[^@]+@(nhs\.net|nhs\.uk|nhft\.nhs\.uk)$';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Add email validation constraint to profiles table
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS valid_nhs_email;

ALTER TABLE public.profiles 
ADD CONSTRAINT valid_nhs_email 
CHECK (validate_nhs_email(email));

-- Improve security settings with password requirements
INSERT INTO public.security_settings (setting_name, setting_value, description, updated_by) 
VALUES 
  ('minimum_password_length', '12', 'Minimum password length requirement', auth.uid()),
  ('require_password_complexity', 'true', 'Require complex passwords with mixed case, numbers, and symbols', auth.uid()),
  ('max_login_attempts', '5', 'Maximum failed login attempts before account lockout', auth.uid()),
  ('account_lockout_duration_minutes', '30', 'Duration of account lockout after max failed attempts', auth.uid())
ON CONFLICT (setting_name) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = now(),
  updated_by = EXCLUDED.updated_by;