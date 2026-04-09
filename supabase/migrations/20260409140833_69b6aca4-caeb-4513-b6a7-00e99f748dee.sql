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
    'amanda.palin2@nhs.net',
    'carolyn.abbisogni@nhs.net',
    'malcolm.railson@nhs.net'
  ])
$$;