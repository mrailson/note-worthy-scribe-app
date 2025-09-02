-- Add live_transcript_text field to meetings table
ALTER TABLE public.meetings 
ADD COLUMN live_transcript_text TEXT DEFAULT NULL;