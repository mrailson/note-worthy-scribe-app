-- Fix RLS policies for user_roles table to allow system admin updates

-- Add policy to allow system admins to update user_roles
CREATE POLICY "System admins can update user roles"
ON public.user_roles
FOR UPDATE
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Add policy to allow system admins to insert user_roles  
CREATE POLICY "System admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (is_system_admin());