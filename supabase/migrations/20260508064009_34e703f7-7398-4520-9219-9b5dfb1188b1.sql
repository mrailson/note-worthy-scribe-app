-- Add missing columns to existing public.agewell_responses (non-destructive)
ALTER TABLE public.agewell_responses
  ADD COLUMN IF NOT EXISTS practice_id text,
  ADD COLUMN IF NOT EXISTS practice_label text,
  ADD COLUMN IF NOT EXISTS rating text,
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS anything_else text,
  ADD COLUMN IF NOT EXISTS elevenlabs_call_id text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_agewell_responses_elevenlabs_call_id
  ON public.agewell_responses (elevenlabs_call_id);

CREATE INDEX IF NOT EXISTS idx_agewell_responses_practice_id
  ON public.agewell_responses (practice_id);