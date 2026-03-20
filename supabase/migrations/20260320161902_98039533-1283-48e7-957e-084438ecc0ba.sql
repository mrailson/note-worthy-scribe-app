ALTER TABLE public.meeting_summaries
ADD COLUMN IF NOT EXISTS generation_metadata jsonb DEFAULT NULL;