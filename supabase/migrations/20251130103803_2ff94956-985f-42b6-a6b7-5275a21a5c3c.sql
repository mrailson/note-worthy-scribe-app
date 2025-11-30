-- Create meeting_qa_sessions table for storing Q&A chat history per meeting
CREATE TABLE IF NOT EXISTS public.meeting_qa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_qa_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own meeting Q&A sessions
CREATE POLICY "Users can manage their own meeting Q&A sessions"
  ON public.meeting_qa_sessions
  FOR ALL
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meeting_qa_sessions_meeting_id ON public.meeting_qa_sessions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_qa_sessions_user_id ON public.meeting_qa_sessions(user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_meeting_qa_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER update_meeting_qa_sessions_updated_at
  BEFORE UPDATE ON public.meeting_qa_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_meeting_qa_sessions_updated_at();