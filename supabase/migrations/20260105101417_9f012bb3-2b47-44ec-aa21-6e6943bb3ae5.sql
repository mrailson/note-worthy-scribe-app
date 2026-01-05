-- Create table for NRES candidate assessment feedback
CREATE TABLE public.nres_candidate_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('ACP', 'GP')),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT,
  agrees_with_assessment BOOLEAN NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups by candidate
CREATE INDEX idx_nres_candidate_feedback_candidate ON public.nres_candidate_feedback(candidate_id, role_type);

-- Create index for user's feedback
CREATE INDEX idx_nres_candidate_feedback_user ON public.nres_candidate_feedback(user_id);

-- Enable Row Level Security
ALTER TABLE public.nres_candidate_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view all feedback (for transparency)
CREATE POLICY "Users can view all candidate feedback"
ON public.nres_candidate_feedback
FOR SELECT
TO authenticated
USING (true);

-- Policy: Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
ON public.nres_candidate_feedback
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own feedback
CREATE POLICY "Users can update their own feedback"
ON public.nres_candidate_feedback
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can delete their own feedback
CREATE POLICY "Users can delete their own feedback"
ON public.nres_candidate_feedback
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_nres_candidate_feedback_updated_at
BEFORE UPDATE ON public.nres_candidate_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();