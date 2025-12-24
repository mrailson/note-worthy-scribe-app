-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "snomed_codes_select_all" ON public.snomed_codes;

-- Create a new policy that requires authentication to view SNOMED codes
CREATE POLICY "snomed_codes_select_authenticated" 
ON public.snomed_codes 
FOR SELECT 
USING (auth.uid() IS NOT NULL);