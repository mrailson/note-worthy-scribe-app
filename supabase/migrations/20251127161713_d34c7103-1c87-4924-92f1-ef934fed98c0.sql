-- Create presentation_sessions table for storing presentation history
CREATE TABLE public.presentation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  presentation_type TEXT NOT NULL,
  template_id TEXT NOT NULL,
  slide_count INTEGER NOT NULL,
  complexity_level TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  slide_images JSONB,
  source_documents JSONB DEFAULT '[]'::jsonb,
  background_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.presentation_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own presentation sessions" 
ON public.presentation_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own presentation sessions" 
ON public.presentation_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presentation sessions" 
ON public.presentation_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presentation sessions" 
ON public.presentation_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_presentation_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_presentation_sessions_updated_at
BEFORE UPDATE ON public.presentation_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_presentation_sessions_updated_at();

-- Create index for faster queries
CREATE INDEX idx_presentation_sessions_user_id ON public.presentation_sessions(user_id);
CREATE INDEX idx_presentation_sessions_created_at ON public.presentation_sessions(created_at DESC);