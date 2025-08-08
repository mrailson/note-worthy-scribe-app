-- Fix critical privilege escalation vulnerability in user_roles table
-- Remove the existing overly permissive policy
DROP POLICY IF EXISTS "System admins can manage PCN practice assignments" ON public.user_roles;

-- Create secure policies for user_roles table
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "System admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (is_system_admin());

CREATE POLICY "System admins can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (is_system_admin());

CREATE POLICY "System admins can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (is_system_admin());

CREATE POLICY "System admins can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (is_system_admin());

-- Fix security definer functions by setting proper search paths
CREATE OR REPLACE FUNCTION public.get_current_user_role(check_user_id uuid DEFAULT auth.uid())
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT role FROM public.user_roles 
  WHERE user_id = check_user_id 
  AND role = 'system_admin'
  LIMIT 1;
$function$;

-- Update other security definer functions to have proper search paths
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'system_admin'
  )
$function$;

-- Add constraint to prevent users from escalating their own privileges
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
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

-- Create trigger to prevent self privilege escalation
DROP TRIGGER IF EXISTS prevent_self_admin_escalation ON public.user_roles;
CREATE TRIGGER prevent_self_admin_escalation
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_privilege_escalation();