-- Fix data retention policies table security issue
-- Restrict access to authenticated users only

-- Enable Row Level Security on data_retention_policies table
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Drop any existing public access policies
DROP POLICY IF EXISTS "Anyone can read data retention policies" ON public.data_retention_policies;
DROP POLICY IF EXISTS "Public can view data retention policies" ON public.data_retention_policies;
DROP POLICY IF EXISTS "Data retention policies are viewable by everyone" ON public.data_retention_policies;

-- Create secure policies for authenticated users only
CREATE POLICY "System admins can manage data retention policies" 
ON public.data_retention_policies 
FOR ALL 
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Authenticated users can view data retention policies" 
ON public.data_retention_policies 
FOR SELECT 
TO authenticated
USING (true);

-- Add security comment
COMMENT ON TABLE public.data_retention_policies IS 'Data retention policies - access restricted to authenticated users only for security';