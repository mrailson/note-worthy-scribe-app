-- Create meeting_generation_log table to track which AI model actually generated each set of meeting notes,
-- including any fallbacks triggered when the primary model failed.

CREATE TABLE IF NOT EXISTS public.meeting_generation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  primary_model TEXT NOT NULL,
  actual_model_used TEXT NOT NULL,
  fallback_count INTEGER NOT NULL DEFAULT 0,
  generation_ms INTEGER,
  failure_reasons JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_generation_log_meeting_id ON public.meeting_generation_log(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_generation_log_created_at ON public.meeting_generation_log(created_at DESC);

ALTER TABLE public.meeting_generation_log ENABLE ROW LEVEL SECURITY;

-- Admin-only read access. Edge functions use the service role key which bypasses RLS for inserts.
CREATE POLICY "System admins can view generation logs"
ON public.meeting_generation_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'system_admin'));