-- Create dictations table for storing GP dictation history
CREATE TABLE public.dictations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  template_type TEXT DEFAULT 'free',
  title TEXT,
  word_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  is_draft BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dictations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own dictations"
ON public.dictations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dictations"
ON public.dictations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dictations"
ON public.dictations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dictations"
ON public.dictations FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_dictations_updated_at
BEFORE UPDATE ON public.dictations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();