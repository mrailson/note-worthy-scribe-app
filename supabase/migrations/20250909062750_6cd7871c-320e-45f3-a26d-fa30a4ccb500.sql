-- Create translation_sessions table for persistent translation history
CREATE TABLE public.translation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_title TEXT NOT NULL,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_end TIMESTAMP WITH TIME ZONE,
  patient_language TEXT NOT NULL DEFAULT 'multiple',
  total_translations INTEGER NOT NULL DEFAULT 0,
  translations JSONB NOT NULL DEFAULT '[]'::jsonb,
  translation_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  session_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  is_protected BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable Row Level Security
ALTER TABLE public.translation_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own translation sessions" 
ON public.translation_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own translation sessions" 
ON public.translation_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own translation sessions" 
ON public.translation_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own unprotected translation sessions" 
ON public.translation_sessions 
FOR DELETE 
USING (auth.uid() = user_id AND is_protected = false);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_translation_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_translation_sessions_updated_at
BEFORE UPDATE ON public.translation_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_translation_sessions_updated_at();

-- Create index for better performance
CREATE INDEX idx_translation_sessions_user_id ON public.translation_sessions(user_id);
CREATE INDEX idx_translation_sessions_created_at ON public.translation_sessions(created_at DESC);
CREATE INDEX idx_translation_sessions_is_active ON public.translation_sessions(is_active);
CREATE INDEX idx_translation_sessions_is_flagged ON public.translation_sessions(is_flagged);
CREATE INDEX idx_translation_sessions_patient_language ON public.translation_sessions(patient_language);