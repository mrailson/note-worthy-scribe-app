-- Create table for storing raw transcript chunks during recording
CREATE TABLE public.raw_transcript_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  chunk_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  confidence REAL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.raw_transcript_chunks ENABLE ROW LEVEL SECURITY;

-- Create policies for user access (users can only access chunks for their own meetings)
CREATE POLICY "Users can view raw chunks for their own meetings" 
ON public.raw_transcript_chunks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = raw_transcript_chunks.meeting_id 
    AND meetings.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create raw chunks for their own meetings" 
ON public.raw_transcript_chunks 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = raw_transcript_chunks.meeting_id 
    AND meetings.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update raw chunks for their own meetings" 
ON public.raw_transcript_chunks 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = raw_transcript_chunks.meeting_id 
    AND meetings.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete raw chunks for their own meetings" 
ON public.raw_transcript_chunks 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = raw_transcript_chunks.meeting_id 
    AND meetings.user_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_raw_transcript_chunks_meeting_id ON public.raw_transcript_chunks(meeting_id);
CREATE INDEX idx_raw_transcript_chunks_chunk_id ON public.raw_transcript_chunks(meeting_id, chunk_id);