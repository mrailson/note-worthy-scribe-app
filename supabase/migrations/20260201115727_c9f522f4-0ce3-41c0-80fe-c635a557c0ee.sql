ALTER TABLE public.meeting_transcription_chunks
ADD COLUMN IF NOT EXISTS confidence_score real GENERATED ALWAYS AS (confidence) STORED;

ALTER TABLE public.meeting_transcription_chunks
ADD COLUMN IF NOT EXISTS source text GENERATED ALWAYS AS (transcriber_type) STORED;