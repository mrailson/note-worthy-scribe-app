-- Create table for AI chat history per consultation
CREATE TABLE public.gp_consultation_ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gp_consultation_ai_chats ENABLE ROW LEVEL SECURITY;

-- Users can only access their own chat history
CREATE POLICY "Users can view own AI chats"
  ON public.gp_consultation_ai_chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own AI chats"
  ON public.gp_consultation_ai_chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI chats"
  ON public.gp_consultation_ai_chats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI chats"
  ON public.gp_consultation_ai_chats FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups by consultation
CREATE INDEX idx_ai_chats_consultation ON public.gp_consultation_ai_chats(consultation_id);
CREATE INDEX idx_ai_chats_user ON public.gp_consultation_ai_chats(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_gp_consultation_ai_chats_updated_at
  BEFORE UPDATE ON public.gp_consultation_ai_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();