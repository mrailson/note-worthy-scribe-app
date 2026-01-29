-- Drop existing policies
DROP POLICY IF EXISTS "Users can create their own consultations" ON public.gp_consultations;
DROP POLICY IF EXISTS "Users can view their own consultations" ON public.gp_consultations;
DROP POLICY IF EXISTS "Users can update their own consultations" ON public.gp_consultations;
DROP POLICY IF EXISTS "Users can delete their own consultations" ON public.gp_consultations;

-- Create new policies that require gp_scribe module access
-- This ensures only users with legitimate clinical access can work with consultations

CREATE POLICY "Clinical users can create their own consultations"
ON public.gp_consultations
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND public.user_has_module_access(auth.uid(), 'gp_scribe')
);

CREATE POLICY "Clinical users can view their own consultations"
ON public.gp_consultations
FOR SELECT
USING (
  auth.uid() = user_id 
  AND public.user_has_module_access(auth.uid(), 'gp_scribe')
);

CREATE POLICY "Clinical users can update their own consultations"
ON public.gp_consultations
FOR UPDATE
USING (
  auth.uid() = user_id 
  AND public.user_has_module_access(auth.uid(), 'gp_scribe')
);

CREATE POLICY "Clinical users can delete their own consultations"
ON public.gp_consultations
FOR DELETE
USING (
  auth.uid() = user_id 
  AND public.user_has_module_access(auth.uid(), 'gp_scribe')
);