-- Fix icn_tl_norm table public access security issue
-- Enable RLS and restrict access to authenticated healthcare users only

-- Enable Row Level Security on icn_tl_norm table
ALTER TABLE public.icn_tl_norm ENABLE ROW LEVEL SECURITY;

-- Drop any existing public access policies (if any)
DROP POLICY IF EXISTS "Anyone can read traffic light data" ON public.icn_tl_norm;
DROP POLICY IF EXISTS "Traffic light data is publicly viewable" ON public.icn_tl_norm;
DROP POLICY IF EXISTS "Public can view traffic light data" ON public.icn_tl_norm;

-- Create secure policies for authenticated healthcare users only
CREATE POLICY "Authenticated healthcare users can view traffic light data" 
ON public.icn_tl_norm 
FOR SELECT 
TO authenticated
USING (true);

-- Allow system admins to manage the data
CREATE POLICY "System admins can manage traffic light data" 
ON public.icn_tl_norm 
FOR ALL 
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Add security comment for documentation
COMMENT ON TABLE public.icn_tl_norm IS 'NHS traffic light drug classification data - access restricted to authenticated healthcare professionals for data protection compliance';

-- Log the security fix
DO $$
BEGIN
    RAISE NOTICE 'Security fix applied: icn_tl_norm table access restricted to authenticated users only';
END
$$;