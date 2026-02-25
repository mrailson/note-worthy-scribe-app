
-- Drop the problematic approver SELECT policy that references auth.users
DROP POLICY IF EXISTS "Approvers can view submitted buyback claims" ON public.nres_buyback_claims;
DROP POLICY IF EXISTS "Approvers can update submitted buyback claims" ON public.nres_buyback_claims;

-- Recreate using auth.jwt() to check email from the token directly
CREATE POLICY "Approvers can view submitted buyback claims"
  ON public.nres_buyback_claims FOR SELECT
  USING (
    (auth.jwt() ->> 'email') IN (
      'm.green28@nhs.net',
      'mark.gray1@nhs.net',
      'amanda.taylor75@nhs.net',
      'carolyn.abbisogni@nhs.net',
      'malcolm.railson@nhs.net'
    )
    AND status IN ('submitted', 'approved', 'rejected')
  );

CREATE POLICY "Approvers can update submitted buyback claims"
  ON public.nres_buyback_claims FOR UPDATE
  USING (
    (auth.jwt() ->> 'email') IN (
      'm.green28@nhs.net',
      'mark.gray1@nhs.net',
      'amanda.taylor75@nhs.net',
      'carolyn.abbisogni@nhs.net',
      'malcolm.railson@nhs.net'
    )
    AND status = 'submitted'
  );
