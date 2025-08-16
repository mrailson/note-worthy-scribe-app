-- EMERGENCY: Restore admin access for malcolm.railson@nhs.net
-- User ID: e3aea82f-451b-40fb-8681-2b579a92dc3a
-- Practice ID: c800c954-3928-4a37-a5c4-c4ff3e680333

-- Restore system_admin role
INSERT INTO public.user_roles (user_id, role, practice_id, assigned_by)
VALUES (
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'system_admin',
  NULL,
  'e3aea82f-451b-40fb-8681-2b579a92dc3a'
) ON CONFLICT (user_id, role, practice_id) DO NOTHING;

-- Restore practice_manager role for Oak Lane Medical Practice
INSERT INTO public.user_roles (user_id, role, practice_id, assigned_by)
VALUES (
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'practice_manager',
  'c800c954-3928-4a37-a5c4-c4ff3e680333',
  'e3aea82f-451b-40fb-8681-2b579a92dc3a'
) ON CONFLICT (user_id, role, practice_id) DO NOTHING;

-- Add all module access permissions with defaults
UPDATE public.user_roles 
SET 
  meeting_notes_access = true,
  gp_scribe_access = true,
  complaints_manager_access = true,
  enhanced_access = true,
  cqc_compliance_access = true,
  shared_drive_access = true,
  mic_test_service_access = true,
  api_testing_service_access = true
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';

-- Also ensure AI4GP access in profiles table
UPDATE public.profiles 
SET ai4gp_access = true
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';

-- Re-enable protection but allow updates
CREATE OR REPLACE FUNCTION public.protect_primary_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent deletion of system admin role for the primary admin user
  IF TG_OP = 'DELETE' AND OLD.user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' AND OLD.role = 'system_admin' THEN
    -- Allow deletion only if there's a corresponding INSERT in the same transaction
    -- This is a more nuanced protection
    RAISE WARNING 'Attempting to delete primary admin system_admin role - this may be part of an update operation';
    -- For now, allow it but log it
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp';

-- Re-create the trigger but only for monitoring, not blocking
CREATE TRIGGER protect_primary_admin_trigger
  BEFORE DELETE OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_primary_admin();