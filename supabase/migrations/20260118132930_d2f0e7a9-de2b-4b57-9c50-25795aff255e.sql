-- Add column for realtime (AssemblyAI/Notewell) transcript to enable comparison
ALTER TABLE public.gp_consultation_transcripts
ADD COLUMN IF NOT EXISTS realtime_transcript TEXT;