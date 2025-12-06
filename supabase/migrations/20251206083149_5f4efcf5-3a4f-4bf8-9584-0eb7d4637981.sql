-- Drop overly permissive policies on data_retention_policies
DROP POLICY IF EXISTS "Authenticated users can view retention policies" ON public.data_retention_policies;
DROP POLICY IF EXISTS "System admins can manage retention policies" ON public.data_retention_policies;
DROP POLICY IF EXISTS "Only system admins can manage data retention policies" ON public.data_retention_policies;
DROP POLICY IF EXISTS "Only system admins can view data retention policies" ON public.data_retention_policies;

-- Create restrictive policies - system admins only
CREATE POLICY "System admins can view data retention policies"
ON public.data_retention_policies
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage data retention policies"
ON public.data_retention_policies
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));