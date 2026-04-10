
-- Drop and recreate all admin policies using auth.jwt() for email
DROP POLICY IF EXISTS "Admins can update evidence config" ON public.nres_claim_evidence_config;
DROP POLICY IF EXISTS "Admins can insert evidence config" ON public.nres_claim_evidence_config;
DROP POLICY IF EXISTS "Admins can delete evidence config" ON public.nres_claim_evidence_config;

CREATE POLICY "Admins can update evidence config"
ON public.nres_claim_evidence_config
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = lower(auth.jwt() ->> 'email')
      AND role IN ('super_admin', 'management_lead')
      AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = lower(auth.jwt() ->> 'email')
      AND role IN ('super_admin', 'management_lead')
      AND is_active = true
  )
);

CREATE POLICY "Admins can insert evidence config"
ON public.nres_claim_evidence_config
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = lower(auth.jwt() ->> 'email')
      AND role IN ('super_admin', 'management_lead')
      AND is_active = true
  )
);

CREATE POLICY "Admins can delete evidence config"
ON public.nres_claim_evidence_config
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = lower(auth.jwt() ->> 'email')
      AND role IN ('super_admin', 'management_lead')
      AND is_active = true
  )
);
