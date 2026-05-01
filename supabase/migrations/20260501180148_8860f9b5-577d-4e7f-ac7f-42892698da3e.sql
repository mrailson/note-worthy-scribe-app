ALTER TABLE public.meeting_generation_log
  ADD COLUMN IF NOT EXISTS skip_reason text,
  ADD COLUMN IF NOT EXISTS detected_content_type text,
  ADD COLUMN IF NOT EXISTS transcript_word_count integer,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS transcript_snippet text;

CREATE INDEX IF NOT EXISTS idx_meeting_generation_log_skip_reason
  ON public.meeting_generation_log (skip_reason)
  WHERE skip_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_generation_log_detected_content_type
  ON public.meeting_generation_log (detected_content_type)
  WHERE detected_content_type IS NOT NULL;