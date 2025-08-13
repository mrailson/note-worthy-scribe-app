-- Create AI 4 PM searches table to store chat history
CREATE TABLE public.ai_4_pm_searches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  brief_overview text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_4_pm_searches ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own AI 4 PM searches" 
ON public.ai_4_pm_searches 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI 4 PM searches" 
ON public.ai_4_pm_searches 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI 4 PM searches" 
ON public.ai_4_pm_searches 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI 4 PM searches" 
ON public.ai_4_pm_searches 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at timestamp
CREATE TRIGGER update_ai_4_pm_searches_updated_at
  BEFORE UPDATE ON public.ai_4_pm_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();