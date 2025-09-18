-- Fix security issue: Restrict access to practice_neighbourhood_assignments table
-- Currently it's publicly readable (true condition), which exposes sensitive healthcare infrastructure data

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view practice neighbourhood assignments" ON public.practice_neighbourhood_assignments;

-- Create a secure policy that only allows authenticated users to view practice assignments
-- Further restrict to users who have practice access or are system admins
CREATE POLICY "Authenticated users can view practice neighbourhood assignments for their practices" 
ON public.practice_neighbourhood_assignments 
FOR SELECT 
TO authenticated
USING (
  -- System admins can see all assignments
  is_system_admin(auth.uid()) OR
  -- Users can only see assignments for practices they have access to
  practice_id = ANY (get_user_practice_ids(auth.uid()))
);

-- Ensure the management policy is still in place for system admins
-- (This should already exist but let's make sure)
DROP POLICY IF EXISTS "System admins can manage practice neighbourhood assignments" ON public.practice_neighbourhood_assignments;
CREATE POLICY "System admins can manage practice neighbourhood assignments" 
ON public.practice_neighbourhood_assignments 
FOR ALL 
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));