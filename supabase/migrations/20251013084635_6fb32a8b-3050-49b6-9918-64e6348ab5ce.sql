-- Create table for Deepgram transcription backup
CREATE TABLE IF NOT EXISTS public.deepgram_transcriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  chunk_number INTEGER NOT NULL,
  transcription_text TEXT NOT NULL,
  confidence REAL,
  is_final BOOLEAN DEFAULT true,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deepgram_transcriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can insert their own deepgram transcriptions" 
ON public.deepgram_transcriptions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own deepgram transcriptions" 
ON public.deepgram_transcriptions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own deepgram transcriptions" 
ON public.deepgram_transcriptions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_deepgram_transcriptions_meeting_session 
ON public.deepgram_transcriptions(meeting_id, session_id, chunk_number);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_deepgram_transcriptions_updated_at
BEFORE UPDATE ON public.deepgram_transcriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();