-- Create admin_dictations table for Admin Dictate tool
CREATE TABLE public.admin_dictations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  cleaned_content TEXT,
  template_type TEXT NOT NULL DEFAULT 'free',
  title TEXT,
  word_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  is_draft BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.admin_dictations ENABLE ROW LEVEL SECURITY;

-- Users can only access their own dictations
CREATE POLICY "Users can view own admin dictations"
  ON public.admin_dictations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own admin dictations"
  ON public.admin_dictations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own admin dictations"
  ON public.admin_dictations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own admin dictations"
  ON public.admin_dictations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for efficient history queries
CREATE INDEX idx_admin_dictations_user_created 
  ON public.admin_dictations(user_id, created_at DESC);

-- Create trigger for auto-updating updated_at
CREATE OR REPLACE TRIGGER update_admin_dictations_updated_at
  BEFORE UPDATE ON public.admin_dictations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();