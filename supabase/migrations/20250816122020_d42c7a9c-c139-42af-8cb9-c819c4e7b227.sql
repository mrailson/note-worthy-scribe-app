-- Add database safeguards to prevent accidental system_admin role deletion

-- Create a function to protect system admin roles
CREATE OR REPLACE FUNCTION public.protect_system_admin_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent deletion of system_admin roles unless done by another system_admin
  IF OLD.role = 'system_admin' THEN
    -- Check if the current user is a system admin
    IF NOT is_system_admin() THEN
      RAISE EXCEPTION 'Only system administrators can remove system admin roles';
    END IF;
    
    -- Log the admin role deletion for audit purposes
    PERFORM public.log_system_activity(
      'user_roles',
      'SYSTEM_ADMIN_ROLE_DELETED',
      OLD.user_id,
      jsonb_build_object('deleted_role', OLD.role, 'practice_id', OLD.practice_id),
      jsonb_build_object('deleted_by', auth.uid(), 'reason', 'admin_role_removal')
    );
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to protect system admin roles
DROP TRIGGER IF EXISTS protect_system_admin_deletion ON public.user_roles;
CREATE TRIGGER protect_system_admin_deletion
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_system_admin_roles();

-- Create a function to prevent accidental role updates that could remove admin privileges
CREATE OR REPLACE FUNCTION public.validate_role_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent downgrading system_admin roles unless done by another system_admin
  IF OLD.role = 'system_admin' AND NEW.role != 'system_admin' THEN
    IF NOT is_system_admin() THEN
      RAISE EXCEPTION 'Only system administrators can modify system admin roles';
    END IF;
    
    -- Log the admin role change
    PERFORM public.log_system_activity(
      'user_roles',
      'SYSTEM_ADMIN_ROLE_CHANGED',
      NEW.user_id,
      jsonb_build_object('old_role', OLD.role, 'practice_id', OLD.practice_id),
      jsonb_build_object('new_role', NEW.role, 'changed_by', auth.uid())
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to validate role updates
DROP TRIGGER IF EXISTS validate_admin_role_updates ON public.user_roles;
CREATE TRIGGER validate_admin_role_updates
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_updates();

-- Restore admin access for the user (with proper safeguards)
DO $$
DECLARE
  admin_user_id UUID := 'e3aea82f-451b-40fb-8681-2b579a92dc3a';
  practice_id_val UUID := 'c800c954-3928-4a37-a5c4-c4ff3e680333';
  system_admin_exists BOOLEAN;
  practice_manager_exists BOOLEAN;
BEGIN
  -- Check if system_admin role exists
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_id = admin_user_id AND role = 'system_admin' AND practice_id IS NULL
  ) INTO system_admin_exists;
  
  -- Check if practice_manager role exists
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_id = admin_user_id AND role = 'practice_manager' AND practice_id = practice_id_val
  ) INTO practice_manager_exists;

  -- Insert system_admin role if it doesn't exist
  IF NOT system_admin_exists THEN
    INSERT INTO public.user_roles (
      user_id, role, practice_id, assigned_by,
      meeting_notes_access, gp_scribe_access, complaints_manager_access,
      enhanced_access, cqc_compliance_access, shared_drive_access,
      mic_test_service_access, api_testing_service_access
    ) VALUES (
      admin_user_id, 'system_admin', NULL, admin_user_id,
      true, true, true, true, true, true, true, true
    );
    
    RAISE NOTICE 'Restored system_admin role for user %', admin_user_id;
  ELSE
    -- Update existing system_admin role to ensure all permissions
    UPDATE public.user_roles SET
      meeting_notes_access = true,
      gp_scribe_access = true,
      complaints_manager_access = true,
      enhanced_access = true,
      cqc_compliance_access = true,
      shared_drive_access = true,
      mic_test_service_access = true,
      api_testing_service_access = true
    WHERE user_id = admin_user_id AND role = 'system_admin' AND practice_id IS NULL;
    
    RAISE NOTICE 'Updated system_admin permissions for user %', admin_user_id;
  END IF;

  -- Insert practice_manager role if it doesn't exist
  IF NOT practice_manager_exists THEN
    INSERT INTO public.user_roles (
      user_id, role, practice_id, assigned_by,
      meeting_notes_access, gp_scribe_access, complaints_manager_access,
      enhanced_access, cqc_compliance_access, shared_drive_access,
      mic_test_service_access, api_testing_service_access
    ) VALUES (
      admin_user_id, 'practice_manager', practice_id_val, admin_user_id,
      true, true, true, true, true, true, true, true
    );
    
    RAISE NOTICE 'Restored practice_manager role for user %', admin_user_id;
  ELSE
    -- Update existing practice_manager role to ensure all permissions
    UPDATE public.user_roles SET
      meeting_notes_access = true,
      gp_scribe_access = true,
      complaints_manager_access = true,
      enhanced_access = true,
      cqc_compliance_access = true,
      shared_drive_access = true,
      mic_test_service_access = true,
      api_testing_service_access = true
    WHERE user_id = admin_user_id AND role = 'practice_manager' AND practice_id = practice_id_val;
    
    RAISE NOTICE 'Updated practice_manager permissions for user %', admin_user_id;
  END IF;
END $$;