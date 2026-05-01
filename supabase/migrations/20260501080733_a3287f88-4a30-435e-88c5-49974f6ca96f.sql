-- Allow SNO Approvers (users with 'approver' access on a practice) and PML Directors
-- to update buyback claims for their assigned practices (e.g. approve / query).

CREATE POLICY "Approvers can update assigned practice buyback claims"
ON public.nres_buyback_claims
FOR UPDATE
TO authenticated
USING (
  has_nres_buyback_access(auth.uid(), practice_key, ARRAY['approver'::text])
  AND status = ANY (ARRAY['submitted'::text, 'verified'::text, 'awaiting_review'::text, 'approved'::text, 'queried'::text])
)
WITH CHECK (
  has_nres_buyback_access(auth.uid(), practice_key, ARRAY['approver'::text])
);

-- Also extend is_nres_admin() so PML Directors / PML Finance / approver-role holders
-- with active system roles get full update visibility consistent with the UI.
CREATE OR REPLACE FUNCTION public.is_nres_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = lower(auth.jwt() ->> 'email')
    AND role IN ('super_admin', 'management_lead', 'pml_director', 'pml_finance')
    AND is_active = true
  )
$function$;