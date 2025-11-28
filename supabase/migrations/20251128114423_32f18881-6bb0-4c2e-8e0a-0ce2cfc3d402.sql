-- Create document_qa_sessions table to store chat histories
CREATE TABLE IF NOT EXISTS public.document_qa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  document_names TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.document_qa_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view their own Q&A sessions"
  ON public.document_qa_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert their own Q&A sessions"
  ON public.document_qa_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update their own Q&A sessions"
  ON public.document_qa_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete their own Q&A sessions"
  ON public.document_qa_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_document_qa_sessions_user_id 
  ON public.document_qa_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_document_qa_sessions_created_at 
  ON public.document_qa_sessions(created_at DESC);