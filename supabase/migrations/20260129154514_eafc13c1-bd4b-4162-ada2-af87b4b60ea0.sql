-- Make NRES claims admin SELECT policies robust to different Supabase JWT email locations

-- Hours entries
DROP POLICY IF EXISTS nres_hours_entries_admin_select ON public.nres_hours_entries;
CREATE POLICY nres_hours_entries_admin_select
ON public.nres_hours_entries
FOR SELECT
USING (
  public.is_system_admin(auth.uid())
  OR lower(COALESCE(
    auth.jwt() ->> 'email',
    auth.jwt() -> 'user_metadata' ->> 'email',
    ''
  )) IN (
    'm.green28@nhs.net',
    'mark.gray1@nhs.net',
    'amanda.taylor75@nhs.net',
    'carolyn.abbisogni@nhs.net'
  )
);

-- Expenses
DROP POLICY IF EXISTS nres_expenses_admin_select ON public.nres_expenses;
CREATE POLICY nres_expenses_admin_select
ON public.nres_expenses
FOR SELECT
USING (
  public.is_system_admin(auth.uid())
  OR lower(COALESCE(
    auth.jwt() ->> 'email',
    auth.jwt() -> 'user_metadata' ->> 'email',
    ''
  )) IN (
    'm.green28@nhs.net',
    'mark.gray1@nhs.net',
    'amanda.taylor75@nhs.net',
    'carolyn.abbisogni@nhs.net'
  )
);

-- Hourly rate settings
DROP POLICY IF EXISTS nres_user_settings_admin_select ON public.nres_user_settings;
CREATE POLICY nres_user_settings_admin_select
ON public.nres_user_settings
FOR SELECT
USING (
  public.is_system_admin(auth.uid())
  OR lower(COALESCE(
    auth.jwt() ->> 'email',
    auth.jwt() -> 'user_metadata' ->> 'email',
    ''
  )) IN (
    'm.green28@nhs.net',
    'mark.gray1@nhs.net',
    'amanda.taylor75@nhs.net',
    'carolyn.abbisogni@nhs.net'
  )
);
