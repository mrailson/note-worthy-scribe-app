-- Part B columns on nres_time_entries
ALTER TABLE public.nres_time_entries
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS cohort text;

ALTER TABLE public.nres_time_entries
  DROP CONSTRAINT IF EXISTS nres_time_entries_category_check;
ALTER TABLE public.nres_time_entries
  ADD CONSTRAINT nres_time_entries_category_check CHECK (category IN ('general','part_b'));

CREATE INDEX IF NOT EXISTS nres_time_entries_user_cat_date_idx
  ON public.nres_time_entries (user_id, category, entry_date DESC);

-- Part B columns on nres_user_activities
ALTER TABLE public.nres_user_activities
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS role text;

ALTER TABLE public.nres_user_activities
  DROP CONSTRAINT IF EXISTS nres_user_activities_category_check;
ALTER TABLE public.nres_user_activities
  ADD CONSTRAINT nres_user_activities_category_check CHECK (category IN ('general','part_b'));

ALTER TABLE public.nres_user_activities
  DROP CONSTRAINT IF EXISTS nres_user_activities_role_check;
ALTER TABLE public.nres_user_activities
  ADD CONSTRAINT nres_user_activities_role_check CHECK (role IS NULL OR role IN ('clinician','manager'));

-- nres_user_profile (one row per user)
CREATE TABLE IF NOT EXISTS public.nres_user_profile (
  user_id uuid PRIMARY KEY,
  default_role text,
  last_category text NOT NULL DEFAULT 'general',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nres_user_profile_role_check CHECK (default_role IS NULL OR default_role IN ('clinician','manager')),
  CONSTRAINT nres_user_profile_last_cat_check CHECK (last_category IN ('general','part_b'))
);

ALTER TABLE public.nres_user_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own nres profile" ON public.nres_user_profile;
CREATE POLICY "Users select own nres profile"
  ON public.nres_user_profile FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own nres profile" ON public.nres_user_profile;
CREATE POLICY "Users insert own nres profile"
  ON public.nres_user_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own nres profile" ON public.nres_user_profile;
CREATE POLICY "Users update own nres profile"
  ON public.nres_user_profile FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own nres profile" ON public.nres_user_profile;
CREATE POLICY "Users delete own nres profile"
  ON public.nres_user_profile FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_nres_user_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_nres_user_profile ON public.nres_user_profile;
CREATE TRIGGER trg_touch_nres_user_profile
  BEFORE UPDATE ON public.nres_user_profile
  FOR EACH ROW EXECUTE FUNCTION public.touch_nres_user_profile_updated_at();