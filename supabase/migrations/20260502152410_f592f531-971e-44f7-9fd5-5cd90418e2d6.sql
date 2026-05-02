DROP TABLE IF EXISTS public.gladia_transcriptions CASCADE;

CREATE TABLE IF NOT EXISTS public.assemblyai_session_diagnostics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NULL,
  user_id UUID NULL,
  session_id TEXT NULL,
  event_type TEXT NOT NULL,
  ws_close_code INT NULL,
  ws_close_reason TEXT NULL,
  reconnect_attempt INT NULL,
  audio_frames_sent INT NULL,
  total_messages INT NULL,
  partial_count INT NULL,
  final_count INT NULL,
  details JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aai_diag_meeting ON public.assemblyai_session_diagnostics(meeting_id);
CREATE INDEX IF NOT EXISTS idx_aai_diag_user ON public.assemblyai_session_diagnostics(user_id);
CREATE INDEX IF NOT EXISTS idx_aai_diag_created ON public.assemblyai_session_diagnostics(created_at DESC);

ALTER TABLE public.assemblyai_session_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AAI diagnostics"
ON public.assemblyai_session_diagnostics
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert AAI diagnostics"
ON public.assemblyai_session_diagnostics
FOR INSERT
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "System admins can read all AAI diagnostics"
ON public.assemblyai_session_diagnostics
FOR SELECT
USING (public.has_role(auth.uid(), 'system_admin'::app_role));