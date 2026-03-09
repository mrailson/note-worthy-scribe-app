
-- Contact groups for approval service
CREATE TABLE public.approval_contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.approval_contact_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contact groups" ON public.approval_contact_groups
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.approval_contact_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.approval_contact_groups(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.approval_contacts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, contact_id)
);

ALTER TABLE public.approval_contact_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own group members" ON public.approval_contact_group_members
  FOR ALL TO authenticated USING (
    group_id IN (SELECT id FROM public.approval_contact_groups WHERE user_id = auth.uid())
  ) WITH CHECK (
    group_id IN (SELECT id FROM public.approval_contact_groups WHERE user_id = auth.uid())
  );

CREATE INDEX idx_approval_contact_groups_user ON public.approval_contact_groups(user_id);
CREATE INDEX idx_approval_contact_group_members_group ON public.approval_contact_group_members(group_id);
