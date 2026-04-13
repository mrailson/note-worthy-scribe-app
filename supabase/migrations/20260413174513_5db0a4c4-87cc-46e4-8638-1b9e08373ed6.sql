
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can read evidence for their claims or admins" ON public.nres_claim_evidence;

-- Create a security definer function to check if user has buyback access for a claim
CREATE OR REPLACE FUNCTION public.can_read_nres_claim_evidence(_user_id uuid, _claim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User uploaded the evidence themselves
    SELECT 1 FROM public.nres_claim_evidence
    WHERE claim_id = _claim_id AND user_id = _user_id
  )
  OR EXISTS (
    -- User has buyback access to the claim's practice
    SELECT 1 FROM public.nres_buyback_claims c
    JOIN public.nres_buyback_access a ON a.practice_key = c.practice_key
    WHERE c.id = _claim_id AND a.user_id = _user_id
  )
  OR public.is_nres_admin(_user_id)
$$;

-- Restricted SELECT policy
CREATE POLICY "Users can read evidence for their claims or admins"
ON public.nres_claim_evidence
FOR SELECT
TO authenticated
USING (
  public.can_read_nres_claim_evidence(auth.uid(), claim_id)
);
