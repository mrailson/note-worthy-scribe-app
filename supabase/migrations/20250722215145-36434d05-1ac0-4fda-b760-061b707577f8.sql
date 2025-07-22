-- Create table for AI 4 PM search history
CREATE TABLE public.ai_4_pm_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  brief_overview TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ai_4_pm_searches ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own searches" 
ON public.ai_4_pm_searches 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own searches" 
ON public.ai_4_pm_searches 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own searches" 
ON public.ai_4_pm_searches 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own searches" 
ON public.ai_4_pm_searches 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ai_4_pm_searches_updated_at
BEFORE UPDATE ON public.ai_4_pm_searches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_ai_4_pm_searches_user_id ON public.ai_4_pm_searches(user_id);
CREATE INDEX idx_ai_4_pm_searches_created_at ON public.ai_4_pm_searches(created_at DESC);