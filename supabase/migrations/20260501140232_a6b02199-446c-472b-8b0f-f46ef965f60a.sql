ALTER TABLE public.meeting_generation_log
  ADD COLUMN IF NOT EXISTS pro_status_code integer,
  ADD COLUMN IF NOT EXISTS pro_elapsed_ms integer,
  ADD COLUMN IF NOT EXISTS pro_error_message text,
  ADD COLUMN IF NOT EXISTS fallback_reason text;

CREATE INDEX IF NOT EXISTS idx_meeting_generation_log_primary_actual
  ON public.meeting_generation_log (primary_model, actual_model_used, created_at DESC);