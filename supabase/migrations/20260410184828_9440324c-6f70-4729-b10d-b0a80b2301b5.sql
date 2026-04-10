
-- Add INSERT policy for admins only
CREATE POLICY "Admins can insert evidence config"
ON public.nres_claim_evidence_config
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
      AND role IN ('super_admin', 'management_lead')
      AND is_active = true
  )
);

-- Add DELETE policy for admins only
CREATE POLICY "Admins can delete evidence config"
ON public.nres_claim_evidence_config
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
      AND role IN ('super_admin', 'management_lead')
      AND is_active = true
  )
);

-- Restrict UPDATE policy to admins only (drop old permissive one)
DROP POLICY IF EXISTS "Authenticated users can update evidence config" ON public.nres_claim_evidence_config;

CREATE POLICY "Admins can update evidence config"
ON public.nres_claim_evidence_config
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
      AND role IN ('super_admin', 'management_lead')
      AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
      AND role IN ('super_admin', 'management_lead')
      AND is_active = true
  )
);

-- Update LTC Slot Type Report: applies_to = all, mandatory = true, sort_order = 3
UPDATE public.nres_claim_evidence_config
SET applies_to = 'all', is_mandatory = true, sort_order = 3, updated_at = now()
WHERE id = '2f2ea7f9-568f-4608-9415-ce3814672623';

-- Update LTC Rota Report: applies_to = all, mandatory = true, sort_order = 4, fix description
UPDATE public.nres_claim_evidence_config
SET applies_to = 'all', is_mandatory = true, sort_order = 4,
    description = 'Report showing new LTC sessions added to the rota as a result of SDA provision',
    updated_at = now()
WHERE id = '17c76f01-0b70-4951-8b71-c1a4dc724421';

-- Update SDA Slot Type Report: mandatory = true
UPDATE public.nres_claim_evidence_config
SET is_mandatory = true, sort_order = 1, updated_at = now()
WHERE id = '50bfc967-0ea4-4336-8c90-5d25b35701c8';

-- Update SDA Rota Report: mandatory = true
UPDATE public.nres_claim_evidence_config
SET is_mandatory = true, sort_order = 2, updated_at = now()
WHERE id = '1597c5f6-6c4d-4a2f-a335-a79ade225965';

-- Update Employment Agreement: sort_order = 5, mandatory = true
UPDATE public.nres_claim_evidence_config
SET sort_order = 5, is_mandatory = true, updated_at = now()
WHERE id = '345f8007-a249-4d18-b54b-851e76c7e193';

-- Insert Cost Declaration (new row)
INSERT INTO public.nres_claim_evidence_config (evidence_type, label, description, applies_to, is_mandatory, sort_order)
VALUES ('cost_declaration', 'Cost Declaration', 'PM or GP declaration confirming claimed costs are true and proper', 'all', true, 6);

-- Update Payslip: sort_order = 7, mandatory = false
UPDATE public.nres_claim_evidence_config
SET sort_order = 7, is_mandatory = false, updated_at = now()
WHERE id = '7d410865-6b42-4869-a438-a8596f4bc9f7';

-- Update Professional Registration: sort_order = 8, mandatory = false
UPDATE public.nres_claim_evidence_config
SET sort_order = 8, is_mandatory = false, updated_at = now()
WHERE id = 'b0781aad-df9b-40a5-a5af-703506a0a38a';

-- Update Contract / Allocation Letter: sort_order = 9, mandatory = true
UPDATE public.nres_claim_evidence_config
SET sort_order = 9, is_mandatory = true, updated_at = now()
WHERE id = '6cc833fe-47f2-4dc0-9d8a-a6b109f67573';

-- Update Other Supporting Evidence: sort_order = 10, mandatory = false
UPDATE public.nres_claim_evidence_config
SET sort_order = 10, is_mandatory = false, updated_at = now()
WHERE id = '7d586dd8-44e3-47f5-b989-8b35b513e591';
