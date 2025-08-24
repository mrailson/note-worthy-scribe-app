-- Create table to store realtime transcription sessions if needed
CREATE TABLE IF NOT EXISTS public.realtime_transcription_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.realtime_transcription_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own transcription sessions" 
ON public.realtime_transcription_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transcription sessions" 
ON public.realtime_transcription_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transcription sessions" 
ON public.realtime_transcription_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);