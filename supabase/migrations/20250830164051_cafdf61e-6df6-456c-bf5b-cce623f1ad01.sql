-- Create low_confidence_chunks table to preserve all filtered transcription attempts
CREATE TABLE public.low_confidence_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID,
  session_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  chunk_number INTEGER NOT NULL,
  transcription_text TEXT NOT NULL,
  confidence DECIMAL(4,3) NOT NULL,
  original_confidence DECIMAL(4,3) NOT NULL,
  transcriber_type TEXT NOT NULL DEFAULT 'unknown',
  filter_reason TEXT NOT NULL,
  contextual_relevance_score DECIMAL(4,3),
  ai_suggested_restoration BOOLEAN DEFAULT false,
  user_action TEXT, -- 'restored', 'ignored', 'marked_silence', 'edited_restored'
  user_edited_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Foreign key relationships (optional since meeting might not exist yet)
  CONSTRAINT fk_low_confidence_meeting 
    FOREIGN KEY (meeting_id) 
    REFERENCES public.meetings(id) 
    ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.low_confidence_chunks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for low_confidence_chunks
CREATE POLICY "Users can insert their own low confidence chunks" 
ON public.low_confidence_chunks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view low confidence chunks for accessible meetings" 
ON public.low_confidence_chunks 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  ((meeting_id IS NOT NULL) AND user_has_meeting_access(meeting_id, auth.uid()))
);

CREATE POLICY "Users can update their own low confidence chunks" 
ON public.low_confidence_chunks 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_low_confidence_chunks_meeting_session 
ON public.low_confidence_chunks(meeting_id, session_id, chunk_number);

CREATE INDEX idx_low_confidence_chunks_user_created 
ON public.low_confidence_chunks(user_id, created_at DESC);

CREATE INDEX idx_low_confidence_chunks_processing 
ON public.low_confidence_chunks(processed_at, ai_suggested_restoration) 
WHERE processed_at IS NULL;

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_low_confidence_chunks_updated_at
BEFORE UPDATE ON public.low_confidence_chunks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();