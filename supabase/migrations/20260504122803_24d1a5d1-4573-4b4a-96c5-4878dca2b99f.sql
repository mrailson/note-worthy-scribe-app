ALTER TABLE public.transcription_pilot_runs
  ADD COLUMN IF NOT EXISTS assemblyai_text TEXT,
  ADD COLUMN IF NOT EXISTS assemblyai_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS assemblyai_cost_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS assemblyai_error TEXT;