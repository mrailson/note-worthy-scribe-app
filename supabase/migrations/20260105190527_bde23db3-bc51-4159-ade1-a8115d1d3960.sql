-- Add audio duration column to complaint_investigation_transcripts
ALTER TABLE public.complaint_investigation_transcripts 
ADD COLUMN audio_duration_seconds integer NULL;

COMMENT ON COLUMN public.complaint_investigation_transcripts.audio_duration_seconds IS 'Duration of the audio file in seconds';