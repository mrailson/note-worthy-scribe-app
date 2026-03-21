-- Create contacts table (user's reusable contact directory)
CREATE TABLE public.contacts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  org TEXT NOT NULL DEFAULT '',
  default_role TEXT NOT NULL DEFAULT 'Guest',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_user_policy ON public.contacts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create meeting_groups table
CREATE TABLE public.meeting_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT '📋',
  contact_ids BIGINT[] DEFAULT '{}',
  additional_members JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_groups_user_id ON public.meeting_groups(user_id);

ALTER TABLE public.meeting_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY meeting_groups_user_policy ON public.meeting_groups
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_meeting_groups_updated_at
  BEFORE UPDATE ON public.meeting_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add attendees JSONB column to meetings table (nullable, no impact on existing rows)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS meeting_attendees_json JSONB DEFAULT NULL;