-- Add columns for better chunk tracking and deduplication
ALTER TABLE public.meeting_transcription_chunks
  ADD COLUMN IF NOT EXISTS is_final boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS seq integer;

-- Create unique constraint to prevent duplicate chunks
CREATE UNIQUE INDEX IF NOT EXISTS ux_chunks_session_seq
  ON public.meeting_transcription_chunks(session_id, seq);