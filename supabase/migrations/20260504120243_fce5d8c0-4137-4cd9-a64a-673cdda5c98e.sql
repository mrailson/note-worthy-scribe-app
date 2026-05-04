CREATE TABLE IF NOT EXISTS public.transcription_pilot_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  label TEXT,
  audio_duration_seconds NUMERIC,
  audio_size_bytes BIGINT,
  audio_mime_type TEXT,
  prompt_used TEXT,
  whisper1_text TEXT,
  whisper1_latency_ms INTEGER,
  whisper1_cost_usd NUMERIC(10, 5),
  whisper1_error TEXT,
  gpt4o_text TEXT,
  gpt4o_latency_ms INTEGER,
  gpt4o_cost_usd NUMERIC(10, 5),
  gpt4o_error TEXT,
  gpt4o_mini_text TEXT,
  gpt4o_mini_latency_ms INTEGER,
  gpt4o_mini_cost_usd NUMERIC(10, 5),
  gpt4o_mini_error TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_transcription_pilot_runs_user_id_created_at
  ON public.transcription_pilot_runs(user_id, created_at DESC);

ALTER TABLE public.transcription_pilot_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own pilot runs"
  ON public.transcription_pilot_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pilot runs"
  ON public.transcription_pilot_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pilot runs"
  ON public.transcription_pilot_runs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pilot runs"
  ON public.transcription_pilot_runs FOR DELETE
  USING (auth.uid() = user_id);