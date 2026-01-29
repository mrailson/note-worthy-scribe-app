-- Fix security-linter issue: do NOT reference user_metadata in RLS.
-- Use a SECURITY DEFINER function that checks the authenticated user's email via auth.users.

CREATE OR REPLACE FUNCTION public.is_nres_claims_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- System admins always allowed
  IF public.is_system_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  -- Resolve email from auth.users (trusted source)
  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF v_email IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_email IN (
    'm.green28@nhs.net',
    'mark.gray1@nhs.net',
    'amanda.taylor75@nhs.net',
    'carolyn.abbisogni@nhs.net'
  );
END;
$$;

-- Lock down function access (needed for RLS evaluation)
REVOKE ALL ON FUNCTION public.is_nres_claims_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_nres_claims_admin() TO authenticated;

-- Recreate admin-read policies using the safe function

-- Hours entries
DROP POLICY IF EXISTS nres_hours_entries_admin_select ON public.nres_hours_entries;
CREATE POLICY nres_hours_entries_admin_select
ON public.nres_hours_entries
FOR SELECT
USING (public.is_nres_claims_admin());

-- Expenses
DROP POLICY IF EXISTS nres_expenses_admin_select ON public.nres_expenses;
CREATE POLICY nres_expenses_admin_select
ON public.nres_expenses
FOR SELECT
USING (public.is_nres_claims_admin());

-- Hourly rate settings
DROP POLICY IF EXISTS nres_user_settings_admin_select ON public.nres_user_settings;
CREATE POLICY nres_user_settings_admin_select
ON public.nres_user_settings
FOR SELECT
USING (public.is_nres_claims_admin());
