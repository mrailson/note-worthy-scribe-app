
-- Create vault user groups table
CREATE TABLE public.nres_vault_user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create vault user group members table
CREATE TABLE public.nres_vault_user_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.nres_vault_user_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.nres_vault_user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nres_vault_user_group_members ENABLE ROW LEVEL SECURITY;

-- RLS: vault admins can manage groups
CREATE POLICY "Vault admins can manage groups"
ON public.nres_vault_user_groups FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.nres_vault_admins WHERE user_id = auth.uid())
);

CREATE POLICY "Vault admins can manage group members"
ON public.nres_vault_user_group_members FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.nres_vault_admins WHERE user_id = auth.uid())
);

-- Authenticated users can read groups (for permission UI)
CREATE POLICY "Authenticated users can read groups"
ON public.nres_vault_user_groups FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can read group members"
ON public.nres_vault_user_group_members FOR SELECT TO authenticated
USING (true);
