-- Create table to track completed/generated policies per practice
CREATE TABLE public.policy_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID REFERENCES public.practice_details(id) ON DELETE SET NULL,
  policy_reference_id UUID NOT NULL REFERENCES public.policy_reference_library(id) ON DELETE CASCADE,
  policy_title TEXT NOT NULL,
  policy_content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  effective_date DATE NOT NULL,
  review_date DATE NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'draft', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one active policy per practice per policy type
  UNIQUE(practice_id, policy_reference_id, status)
);

-- Enable RLS
ALTER TABLE public.policy_completions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own policy completions"
  ON public.policy_completions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own policy completions"
  ON public.policy_completions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own policy completions"
  ON public.policy_completions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own policy completions"
  ON public.policy_completions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_policy_completions_updated_at
  BEFORE UPDATE ON public.policy_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_policy_completions_user_practice ON public.policy_completions(user_id, practice_id);
CREATE INDEX idx_policy_completions_policy_ref ON public.policy_completions(policy_reference_id);