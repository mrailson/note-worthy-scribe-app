-- Create table to store individual transcription chunks
CREATE TABLE public.meeting_transcription_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  user_id UUID NOT NULL,
  chunk_number INTEGER NOT NULL,
  transcription_text TEXT NOT NULL,
  confidence REAL DEFAULT 0.9,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_id TEXT NOT NULL -- To group chunks from same recording session
);

-- Add index for efficient querying
CREATE INDEX idx_meeting_transcription_chunks_meeting_session 
ON public.meeting_transcription_chunks(meeting_id, session_id, chunk_number);

-- Add index for user access
CREATE INDEX idx_meeting_transcription_chunks_user 
ON public.meeting_transcription_chunks(user_id);

-- Enable RLS
ALTER TABLE public.meeting_transcription_chunks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can insert their own transcription chunks" 
ON public.meeting_transcription_chunks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own transcription chunks" 
ON public.meeting_transcription_chunks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own transcription chunks" 
ON public.meeting_transcription_chunks 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Function to get combined transcript for a meeting session
CREATE OR REPLACE FUNCTION public.get_combined_transcript(
  p_meeting_id UUID,
  p_session_id TEXT
) RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT string_agg(transcription_text, ' ' ORDER BY chunk_number)
  FROM public.meeting_transcription_chunks
  WHERE meeting_id = p_meeting_id 
    AND session_id = p_session_id
    AND user_id = auth.uid();
$$;