-- Create genie_sessions table for conversation history
CREATE TABLE IF NOT EXISTS public.genie_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('gp-genie', 'pm-genie', 'patient-line')),
  title TEXT,
  brief_overview TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER,
  message_count INTEGER,
  email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.genie_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own genie sessions"
  ON public.genie_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own genie sessions"
  ON public.genie_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own genie sessions"
  ON public.genie_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own genie sessions"
  ON public.genie_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_genie_sessions_user_service ON public.genie_sessions(user_id, service_type, created_at DESC);