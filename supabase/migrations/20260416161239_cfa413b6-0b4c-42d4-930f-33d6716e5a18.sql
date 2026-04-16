ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS transcript_updated_at TIMESTAMPTZ;