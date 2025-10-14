-- Add assembly_ai_transcript column to meetings table for backup transcription
ALTER TABLE public.meetings 
ADD COLUMN assembly_ai_transcript TEXT;

COMMENT ON COLUMN public.meetings.assembly_ai_transcript IS 'Backup transcript from Assembly AI realtime service for comparison and backup purposes';