-- Create table for user-specific name/spelling corrections
CREATE TABLE public.user_name_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incorrect_spelling TEXT NOT NULL,
  correct_spelling TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, incorrect_spelling)
);

-- Enable RLS
ALTER TABLE public.user_name_corrections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own corrections
CREATE POLICY "Users can view their own corrections"
ON public.user_name_corrections
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own corrections
CREATE POLICY "Users can create their own corrections"
ON public.user_name_corrections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own corrections
CREATE POLICY "Users can update their own corrections"
ON public.user_name_corrections
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own corrections
CREATE POLICY "Users can delete their own corrections"
ON public.user_name_corrections
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_name_corrections_updated_at
BEFORE UPDATE ON public.user_name_corrections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();