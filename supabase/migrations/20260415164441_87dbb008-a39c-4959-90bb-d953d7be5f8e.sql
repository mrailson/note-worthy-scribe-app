CREATE OR REPLACE FUNCTION public.has_nres_buyback_access(_user_id uuid, _practice_key text, _roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.nres_buyback_access a
    WHERE a.user_id = _user_id
      AND a.practice_key = _practice_key
      AND (_roles IS NULL OR a.access_role = ANY (_roles))
  )
  OR public.is_nres_admin(_user_id);
$$;

DROP POLICY IF EXISTS "Assigned practice users can view buyback claims" ON public.nres_buyback_claims;
CREATE POLICY "Assigned practice users can view buyback claims"
ON public.nres_buyback_claims
FOR SELECT
TO authenticated
USING (
  public.has_nres_buyback_access(auth.uid(), practice_key, ARRAY['view','submit','approver','verifier'])
);

DROP POLICY IF EXISTS "Assigned practice submitters can update practice buyback claims" ON public.nres_buyback_claims;
CREATE POLICY "Assigned practice submitters can update practice buyback claims"
ON public.nres_buyback_claims
FOR UPDATE
TO authenticated
USING (
  public.has_nres_buyback_access(auth.uid(), practice_key, ARRAY['submit'])
  AND status IN ('draft', 'queried')
)
WITH CHECK (
  public.has_nres_buyback_access(auth.uid(), practice_key, ARRAY['submit'])
);