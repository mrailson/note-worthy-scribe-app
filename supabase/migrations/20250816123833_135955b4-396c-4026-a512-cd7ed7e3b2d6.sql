-- Step 1: Immediate Recovery - Restore system_admin role
-- First, let's ensure the user has system_admin role restored
INSERT INTO public.user_roles (user_id, role, practice_id, assigned_by)
SELECT 
  'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid,
  'system_admin'::app_role,
  NULL,
  'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid 
  AND role = 'system_admin'::app_role
);

-- Step 2: Database-Level Protection - Create trigger to prevent system_admin deletion
CREATE OR REPLACE FUNCTION prevent_system_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent deletion of system_admin roles
  IF OLD.role = 'system_admin' THEN
    -- Log the attempt
    INSERT INTO public.system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      user_email,
      old_values,
      new_values
    ) VALUES (
      'user_roles',
      'BLOCKED_SYSTEM_ADMIN_DELETION',
      OLD.id,
      COALESCE(auth.uid(), OLD.user_id),
      COALESCE(auth.email(), 'system'),
      row_to_json(OLD),
      jsonb_build_object('reason', 'System admin roles cannot be deleted', 'blocked_at', now())
    );
    
    -- Raise an exception to prevent the deletion
    RAISE EXCEPTION 'Cannot delete system_admin role. System administrators are protected from deletion.';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS prevent_system_admin_deletion_trigger ON public.user_roles;
CREATE TRIGGER prevent_system_admin_deletion_trigger
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_admin_deletion();

-- Step 3: Enhanced protection for system_admin role updates
CREATE OR REPLACE FUNCTION protect_system_admin_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changing system_admin role to something else
  IF OLD.role = 'system_admin' AND NEW.role != 'system_admin' THEN
    -- Log the attempt
    INSERT INTO public.system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      user_email,
      old_values,
      new_values
    ) VALUES (
      'user_roles',
      'BLOCKED_SYSTEM_ADMIN_ROLE_CHANGE',
      OLD.id,
      COALESCE(auth.uid(), OLD.user_id),
      COALESCE(auth.email(), 'system'),
      row_to_json(OLD),
      row_to_json(NEW)
    );
    
    RAISE EXCEPTION 'Cannot change system_admin role. System administrators are protected from role changes.';
  END IF;
  
  -- Prevent assigning practice_id to system_admin roles
  IF NEW.role = 'system_admin' AND NEW.practice_id IS NOT NULL THEN
    NEW.practice_id = NULL;
    
    -- Log the correction
    INSERT INTO public.system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      user_email,
      old_values,
      new_values
    ) VALUES (
      'user_roles',
      'CORRECTED_SYSTEM_ADMIN_PRACTICE_ID',
      NEW.id,
      COALESCE(auth.uid(), NEW.user_id),
      COALESCE(auth.email(), 'system'),
      jsonb_build_object('attempted_practice_id', NEW.practice_id),
      jsonb_build_object('corrected_practice_id', NULL)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the update protection trigger
DROP TRIGGER IF EXISTS protect_system_admin_updates_trigger ON public.user_roles;
CREATE TRIGGER protect_system_admin_updates_trigger
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION protect_system_admin_updates();

-- Step 4: Enhanced remove_user_from_practice function with system_admin protection
CREATE OR REPLACE FUNCTION public.remove_user_from_practice(p_user_id uuid, p_practice_id uuid, p_role app_role DEFAULT NULL::app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- CRITICAL: Never remove system_admin roles
  IF p_role = 'system_admin' OR (p_role IS NULL AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id 
    AND practice_id = p_practice_id 
    AND role = 'system_admin'
  )) THEN
    -- Log the blocked attempt
    PERFORM public.log_system_activity(
      'user_roles',
      'BLOCKED_SYSTEM_ADMIN_REMOVAL',
      p_user_id,
      jsonb_build_object(
        'practice_id', p_practice_id,
        'attempted_role', p_role,
        'blocked_by', 'system_protection',
        'blocked_at', now()
      ),
      NULL
    );
    
    RAISE EXCEPTION 'Cannot remove system_admin roles. System administrators are protected.';
  END IF;

  -- If role specified, remove specific role assignment (but never system_admin)
  IF p_role IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id 
      AND practice_id = p_practice_id 
      AND role = p_role
      AND role != 'system_admin'; -- Extra protection
  ELSE
    -- Remove all role assignments for this practice (but never system_admin)
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id 
      AND practice_id = p_practice_id
      AND role != 'system_admin'; -- Extra protection
  END IF;

  -- Log the removal
  PERFORM public.log_system_activity(
    'user_roles',
    'PRACTICE_ASSIGNMENT_REMOVED',
    p_user_id,
    jsonb_build_object(
      'practice_id', p_practice_id,
      'role', p_role,
      'removed_by', auth.uid()
    ),
    NULL
  );

  RETURN FOUND;
END;
$function$;