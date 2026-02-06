-- Add columns for canonical transcript and audit log
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS best_of_all_transcript text,
  ADD COLUMN IF NOT EXISTS merge_decision_log jsonb;

-- Update CHECK constraint to include deepgram and best_of_all
ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_primary_transcript_source_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_primary_transcript_source_check
  CHECK (primary_transcript_source IS NULL OR primary_transcript_source = ANY(
    ARRAY['whisper','assembly','deepgram','consolidated','best_of_all']
  ));