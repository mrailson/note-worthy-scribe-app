-- Fix security issues in the functions by adding proper search paths

-- Update the protect_system_admin_roles function with proper search path
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
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public', 'pg_temp';

-- Update the validate_role_updates function with proper search path
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
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public', 'pg_temp';