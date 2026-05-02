ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS refine_count integer NOT NULL DEFAULT 0;