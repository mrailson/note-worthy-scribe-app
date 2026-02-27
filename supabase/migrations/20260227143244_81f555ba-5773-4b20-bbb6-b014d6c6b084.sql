
-- NRES Vault admins table (create first so settings policies can reference it)
CREATE TABLE public.nres_vault_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_super_admin boolean NOT NULL DEFAULT false,
  is_admin boolean NOT NULL DEFAULT false,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.nres_vault_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vault admins"
  ON public.nres_vault_admins FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can insert vault admins"
  ON public.nres_vault_admins FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.nres_vault_admins WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins can update vault admins"
  ON public.nres_vault_admins FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nres_vault_admins WHERE user_id = auth.uid() AND is_super_admin = true));

CREATE POLICY "Super admins can delete vault admins"
  ON public.nres_vault_admins FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nres_vault_admins WHERE user_id = auth.uid() AND is_super_admin = true));

-- Seed malcolm.railson@nhs.net as super admin
INSERT INTO public.nres_vault_admins (user_id, is_super_admin, is_admin)
SELECT id, true, true FROM auth.users WHERE email = 'malcolm.railson@nhs.net' LIMIT 1;

-- NRES Vault settings (singleton)
CREATE TABLE public.nres_vault_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  max_file_size_mb integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nres_vault_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.nres_vault_settings (max_file_size_mb) VALUES (50);

CREATE POLICY "Authenticated users can read vault settings"
  ON public.nres_vault_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Vault admins can update vault settings"
  ON public.nres_vault_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nres_vault_admins WHERE user_id = auth.uid() AND (is_super_admin = true OR is_admin = true)));

CREATE TRIGGER update_nres_vault_settings_updated_at
  BEFORE UPDATE ON public.nres_vault_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
