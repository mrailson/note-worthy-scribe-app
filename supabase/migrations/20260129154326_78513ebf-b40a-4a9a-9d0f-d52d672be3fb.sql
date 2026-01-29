-- Allow NRES claims admins to view all users' claims data (hours, expenses, and hourly rates)

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.nres_hours_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nres_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nres_user_settings ENABLE ROW LEVEL SECURITY;

-- Admin list (email-based) matches frontend AdminClaimsReport
-- NOTE: Policies are additive, so existing "own rows" policies continue to work.

DO $$
BEGIN
  CREATE POLICY nres_hours_entries_admin_select
  ON public.nres_hours_entries
  FOR SELECT
  USING (
    public.is_system_admin(auth.uid())
    OR lower(auth.jwt() ->> 'email') IN (
      'm.green28@nhs.net',
      'mark.gray1@nhs.net',
      'amanda.taylor75@nhs.net',
      'carolyn.abbisogni@nhs.net'
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY nres_expenses_admin_select
  ON public.nres_expenses
  FOR SELECT
  USING (
    public.is_system_admin(auth.uid())
    OR lower(auth.jwt() ->> 'email') IN (
      'm.green28@nhs.net',
      'mark.gray1@nhs.net',
      'amanda.taylor75@nhs.net',
      'carolyn.abbisogni@nhs.net'
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY nres_user_settings_admin_select
  ON public.nres_user_settings
  FOR SELECT
  USING (
    public.is_system_admin(auth.uid())
    OR lower(auth.jwt() ->> 'email') IN (
      'm.green28@nhs.net',
      'mark.gray1@nhs.net',
      'amanda.taylor75@nhs.net',
      'carolyn.abbisogni@nhs.net'
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
