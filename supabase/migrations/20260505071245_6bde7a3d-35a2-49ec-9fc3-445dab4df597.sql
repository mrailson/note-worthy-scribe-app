-- nres_user_activities
CREATE TABLE public.nres_user_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, label)
);

ALTER TABLE public.nres_user_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own activities" ON public.nres_user_activities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own activities" ON public.nres_user_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own activities" ON public.nres_user_activities
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own activities" ON public.nres_user_activities
  FOR DELETE USING (auth.uid() = user_id);

-- nres_time_entries
CREATE TABLE public.nres_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  activity text NOT NULL,
  minutes int NOT NULL CHECK (minutes >= 15 AND minutes % 15 = 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nres_time_entries_user_date
  ON public.nres_time_entries (user_id, entry_date DESC);

ALTER TABLE public.nres_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own time entries" ON public.nres_time_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own time entries" ON public.nres_time_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own time entries" ON public.nres_time_entries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own time entries" ON public.nres_time_entries
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_nres_time_entries_updated_at
  BEFORE UPDATE ON public.nres_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();