
-- Drop existing restrictive policies on nres_buyback_staff
DROP POLICY IF EXISTS "Users can view their own buyback staff" ON public.nres_buyback_staff;
DROP POLICY IF EXISTS "Users can insert their own buyback staff" ON public.nres_buyback_staff;
DROP POLICY IF EXISTS "Users can update their own buyback staff" ON public.nres_buyback_staff;
DROP POLICY IF EXISTS "Users can delete their own buyback staff" ON public.nres_buyback_staff;
DROP POLICY IF EXISTS "NRES admins can view all buyback staff" ON public.nres_buyback_staff;
DROP POLICY IF EXISTS "NRES admins can insert buyback staff" ON public.nres_buyback_staff;
DROP POLICY IF EXISTS "NRES admins can update buyback staff" ON public.nres_buyback_staff;
DROP POLICY IF EXISTS "NRES admins can delete buyback staff" ON public.nres_buyback_staff;
DROP POLICY IF EXISTS "Admins can manage all buyback staff" ON public.nres_buyback_staff;

-- SELECT: practice-assigned users (view or submit) + admins
CREATE POLICY "Practice users can view buyback staff"
ON public.nres_buyback_staff FOR SELECT TO authenticated
USING (
  public.has_nres_buyback_access(auth.uid(), practice_key, ARRAY['view','submit','approver','verifier'])
  OR auth.uid() = user_id
);

-- INSERT: practice submitters + admins
CREATE POLICY "Practice submitters can add buyback staff"
ON public.nres_buyback_staff FOR INSERT TO authenticated
WITH CHECK (
  public.has_nres_buyback_access(auth.uid(), practice_key, ARRAY['submit'])
  OR auth.uid() = user_id
);

-- UPDATE: practice submitters + admins
CREATE POLICY "Practice submitters can update buyback staff"
ON public.nres_buyback_staff FOR UPDATE TO authenticated
USING (
  public.has_nres_buyback_access(auth.uid(), practice_key, ARRAY['submit'])
  OR auth.uid() = user_id
);

-- DELETE: practice submitters + admins
CREATE POLICY "Practice submitters can delete buyback staff"
ON public.nres_buyback_staff FOR DELETE TO authenticated
USING (
  public.has_nres_buyback_access(auth.uid(), practice_key, ARRAY['submit'])
  OR auth.uid() = user_id
);
