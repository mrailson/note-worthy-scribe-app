-- Restore admin access for malcolm.railson@nhs.net
-- User ID: e3aea82f-451b-40fb-8681-2b579a92dc3a
-- Practice ID: c800c954-3928-4a37-a5c4-c4ff3e680333

-- First, ensure the user has system_admin role
INSERT INTO public.user_roles (user_id, role, practice_id, assigned_by)
VALUES (
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'system_admin',
  NULL,
  'e3aea82f-451b-40fb-8681-2b579a92dc3a'
) ON CONFLICT (user_id, role, practice_id) DO NOTHING;

-- Ensure the user has practice_manager role for Oak Lane Medical Practice
INSERT INTO public.user_roles (user_id, role, practice_id, assigned_by)
VALUES (
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'practice_manager',
  'c800c954-3928-4a37-a5c4-c4ff3e680333',
  'e3aea82f-451b-40fb-8681-2b579a92dc3a'
) ON CONFLICT (user_id, role, practice_id) DO NOTHING;

-- Add protection: Create a function to prevent removal of the primary admin
CREATE OR REPLACE FUNCTION public.protect_primary_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent deletion of system admin role for the primary admin user
  IF OLD.user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' AND OLD.role = 'system_admin' THEN
    RAISE EXCEPTION 'Cannot remove system_admin role from primary administrator. Contact support if this access needs to be modified.';
  END IF;
  
  -- Prevent role changes that would remove admin access for primary admin
  IF TG_OP = 'UPDATE' AND OLD.user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' AND OLD.role = 'system_admin' AND NEW.role != 'system_admin' THEN
    RAISE EXCEPTION 'Cannot modify system_admin role for primary administrator. Contact support if this access needs to be modified.';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to protect primary admin role
DROP TRIGGER IF EXISTS protect_primary_admin_trigger ON public.user_roles;
CREATE TRIGGER protect_primary_admin_trigger
  BEFORE DELETE OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_primary_admin();

-- Log the restoration
INSERT INTO public.system_audit_log (
  table_name,
  operation,
  record_id,
  user_id,
  user_email,
  new_values
) VALUES (
  'user_roles',
  'ADMIN_ACCESS_RESTORED',
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'malcolm.railson@nhs.net',
  jsonb_build_object(
    'roles_restored', ARRAY['system_admin', 'practice_manager'],
    'protection_added', true,
    'timestamp', now()
  )
);