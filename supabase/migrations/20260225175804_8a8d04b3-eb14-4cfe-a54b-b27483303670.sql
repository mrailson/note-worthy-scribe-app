
-- Add staff_category and practice_key to nres_buyback_staff
ALTER TABLE public.nres_buyback_staff
  ADD COLUMN IF NOT EXISTS staff_category text NOT NULL DEFAULT 'buyback',
  ADD COLUMN IF NOT EXISTS practice_key text;

-- Add practice_key to nres_buyback_claims
ALTER TABLE public.nres_buyback_claims
  ADD COLUMN IF NOT EXISTS practice_key text;

-- Create a security definer function to check if a user is an NRES admin
CREATE OR REPLACE FUNCTION public.is_nres_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email') = ANY(ARRAY[
    'm.green28@nhs.net',
    'mark.gray1@nhs.net',
    'amanda.taylor75@nhs.net',
    'carolyn.abbisogni@nhs.net',
    'malcolm.railson@nhs.net'
  ])
$$;

-- Update nres_buyback_staff RLS: admins can view all staff
DROP POLICY IF EXISTS "Users can view own practice buyback staff" ON public.nres_buyback_staff;
CREATE POLICY "Users can view own or admin all buyback staff"
  ON public.nres_buyback_staff FOR SELECT
  USING (auth.uid() = user_id OR public.is_nres_admin());

-- Admins can insert staff for any user
DROP POLICY IF EXISTS "Users can insert own buyback staff" ON public.nres_buyback_staff;
CREATE POLICY "Users can insert own or admin any buyback staff"
  ON public.nres_buyback_staff FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_nres_admin());

-- Admins can update any staff
DROP POLICY IF EXISTS "Users can update own buyback staff" ON public.nres_buyback_staff;
CREATE POLICY "Users can update own or admin any buyback staff"
  ON public.nres_buyback_staff FOR UPDATE
  USING (auth.uid() = user_id OR public.is_nres_admin());

-- Admins can delete any staff
DROP POLICY IF EXISTS "Users can delete own buyback staff" ON public.nres_buyback_staff;
CREATE POLICY "Users can delete own or admin any buyback staff"
  ON public.nres_buyback_staff FOR DELETE
  USING (auth.uid() = user_id OR public.is_nres_admin());

-- Update nres_buyback_claims RLS: admins can view ALL claims (not just submitted)
DROP POLICY IF EXISTS "Approvers can view submitted buyback claims" ON public.nres_buyback_claims;
CREATE POLICY "Admins can view all buyback claims"
  ON public.nres_buyback_claims FOR SELECT
  USING (public.is_nres_admin());

-- Admins can insert claims on behalf of any user
DROP POLICY IF EXISTS "Users can insert own buyback claims" ON public.nres_buyback_claims;
CREATE POLICY "Users can insert own or admin any buyback claims"
  ON public.nres_buyback_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_nres_admin());

-- Admins can update any claim (not just submitted ones)
DROP POLICY IF EXISTS "Approvers can update submitted buyback claims" ON public.nres_buyback_claims;
CREATE POLICY "Admins can update any buyback claims"
  ON public.nres_buyback_claims FOR UPDATE
  USING (public.is_nres_admin());

-- Admins can delete claims too
DROP POLICY IF EXISTS "Users can delete own draft buyback claims" ON public.nres_buyback_claims;
CREATE POLICY "Users can delete own draft or admin any buyback claims"
  ON public.nres_buyback_claims FOR DELETE
  USING ((auth.uid() = user_id AND status = 'draft') OR public.is_nres_admin());
