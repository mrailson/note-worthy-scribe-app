-- Fix data retention policies table security - restrict to administrators only
-- This addresses the PUBLIC_DATA_RETENTION_POLICIES security issue

-- Ensure RLS is enabled on data_retention_policies table
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies that might allow public access
DROP POLICY IF EXISTS "Anyone can read data retention policies" ON public.data_retention_policies;
DROP POLICY IF EXISTS "Public can view data retention policies" ON public.data_retention_policies;
DROP POLICY IF EXISTS "Data retention policies are viewable by everyone" ON public.data_retention_policies;
DROP POLICY IF EXISTS "Authenticated users can view data retention policies" ON public.data_retention_policies;
DROP POLICY IF EXISTS "System admins can manage data retention policies" ON public.data_retention_policies;

-- Create restrictive policies - ONLY system administrators can access
CREATE POLICY "Only system admins can view data retention policies" 
ON public.data_retention_policies 
FOR SELECT 
TO authenticated
USING (is_system_admin(auth.uid()));

CREATE POLICY "Only system admins can manage data retention policies" 
ON public.data_retention_policies 
FOR ALL 
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Add security comment for compliance documentation
COMMENT ON TABLE public.data_retention_policies IS 'Internal data retention governance - RESTRICTED ACCESS - System administrators only for security compliance';

-- Verify the table has proper security by checking if any non-admin policies exist
-- This query will help identify if there are any remaining security gaps
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO policy_count
    FROM pg_policies 
    WHERE tablename = 'data_retention_policies' 
    AND schemaname = 'public'
    AND qual NOT LIKE '%is_system_admin%';
    
    IF policy_count > 0 THEN
        RAISE WARNING 'Found % policies on data_retention_policies that may not be secure', policy_count;
    END IF;
END
$$;