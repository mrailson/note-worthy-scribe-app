
-- Create the nres_system_roles table
CREATE TABLE public.nres_system_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'management_lead', 'pml_director', 'pml_finance')),
  organisation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_email, role)
);

ALTER TABLE public.nres_system_roles ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read roles (needed for permission checks)
CREATE POLICY "Authenticated can read system roles"
  ON public.nres_system_roles FOR SELECT
  TO authenticated USING (true);

-- Only super admins can manage roles (uses current is_nres_admin before we update it)
CREATE POLICY "Super admins can manage system roles"
  ON public.nres_system_roles FOR ALL
  TO authenticated
  USING (public.is_nres_admin())
  WITH CHECK (public.is_nres_admin());

-- Seed initial roles
INSERT INTO public.nres_system_roles (user_email, user_name, role, organisation) VALUES
  ('malcolm.railson@nhs.net', 'Malcolm Railson', 'super_admin', 'PCN Services Ltd'),
  ('amanda.palin2@nhs.net', 'Amanda Palin', 'super_admin', 'Brackley & Towcester PCN Ltd'),
  ('amanda.palin2@nhs.net', 'Amanda Palin', 'management_lead', 'Brackley & Towcester PCN Ltd'),
  ('lucy.hibberd@nhs.net', 'Lucy Hibberd', 'management_lead', 'Bugbrooke Medical Practice'),
  ('m.green28@nhs.net', 'Michael Green', 'super_admin', NULL),
  ('mark.gray1@nhs.net', 'Mark Gray', 'management_lead', NULL),
  ('carolyn.abbisogni@nhs.net', 'Carolyn Abbisogni', 'management_lead', NULL),
  ('andrew.moore46@nhs.net', 'Andrew Moore', 'pml_director', 'PML')
ON CONFLICT (user_email, role) DO NOTHING;

-- Update is_nres_admin() to use the table instead of hardcoded emails
CREATE OR REPLACE FUNCTION public.is_nres_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = lower(auth.jwt() ->> 'email')
    AND role IN ('super_admin', 'management_lead')
    AND is_active = true
  )
$$;

-- Create is_pml_user() helper
CREATE OR REPLACE FUNCTION public.is_pml_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = lower(auth.jwt() ->> 'email')
    AND role IN ('pml_director', 'pml_finance')
    AND is_active = true
  )
$$;

-- Add updated_at trigger
CREATE TRIGGER update_nres_system_roles_updated_at
  BEFORE UPDATE ON public.nres_system_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
