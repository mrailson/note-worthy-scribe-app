-- Add columns to meetings table for dual transcription support
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS assembly_transcript_text TEXT,
ADD COLUMN IF NOT EXISTS whisper_transcript_text TEXT,
ADD COLUMN IF NOT EXISTS primary_transcript_source TEXT DEFAULT 'whisper',
ADD COLUMN IF NOT EXISTS assembly_confidence REAL,
ADD COLUMN IF NOT EXISTS whisper_confidence REAL;

-- Create assembly_transcripts table for real-time Assembly AI results
CREATE TABLE IF NOT EXISTS public.assembly_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  transcript_text TEXT NOT NULL,
  confidence REAL,
  is_final BOOLEAN DEFAULT false,
  timestamp_ms BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on assembly_transcripts
ALTER TABLE public.assembly_transcripts ENABLE ROW LEVEL SECURITY;

-- Create policies for assembly_transcripts
CREATE POLICY "Users can insert their own assembly transcripts" 
ON public.assembly_transcripts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view assembly transcripts for accessible meetings" 
ON public.assembly_transcripts 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  user_has_meeting_access(meeting_id, auth.uid())
);

CREATE POLICY "Users can update their own assembly transcripts" 
ON public.assembly_transcripts 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_assembly_transcripts_meeting_session 
ON public.assembly_transcripts(meeting_id, session_id, chunk_index);

-- Add trigger for updated_at
CREATE TRIGGER update_assembly_transcripts_updated_at
  BEFORE UPDATE ON public.assembly_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();