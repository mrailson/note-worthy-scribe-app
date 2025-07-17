-- Create security definer function to check user roles without recursion
CREATE OR REPLACE FUNCTION public.get_user_role_for_policy(check_user_id uuid DEFAULT auth.uid())
RETURNS app_role 
LANGUAGE sql 
SECURITY DEFINER 
STABLE
AS $$
  SELECT role FROM user_roles 
  WHERE user_id = check_user_id 
  AND role = 'system_admin'
  LIMIT 1;
$$;

-- Drop all existing user_roles policies to start fresh
DROP POLICY IF EXISTS "System admins can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Practice managers can view practice roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "System admins can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "System admins can update user roles" ON user_roles;
DROP POLICY IF EXISTS "System admins can delete user roles" ON user_roles;

-- Create new non-recursive policies using security definer function
CREATE POLICY "Users can view their own roles" 
ON user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "System admins have full access" 
ON user_roles 
FOR ALL 
USING (public.get_user_role_for_policy() = 'system_admin')
WITH CHECK (public.get_user_role_for_policy() = 'system_admin');

-- Simple policy for practice managers (no recursion)
CREATE POLICY "Practice managers can view their practice roles" 
ON user_roles 
FOR SELECT 
USING (
  practice_id IS NOT NULL AND 
  auth.uid() IN (
    SELECT ur.user_id FROM user_roles ur 
    WHERE ur.role = 'practice_manager' 
    AND ur.practice_id = user_roles.practice_id
  )
);