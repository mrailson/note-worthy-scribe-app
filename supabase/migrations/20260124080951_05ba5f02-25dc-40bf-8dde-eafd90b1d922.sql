-- Create reception translation sessions table
CREATE TABLE public.reception_translation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_language TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 minutes')
);

-- Enable Row Level Security
ALTER TABLE public.reception_translation_sessions ENABLE ROW LEVEL SECURITY;

-- Staff can manage their own sessions
CREATE POLICY "Users can view their own sessions"
ON public.reception_translation_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
ON public.reception_translation_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
ON public.reception_translation_sessions
FOR UPDATE
USING (auth.uid() = user_id);

-- Public read policy for session validation (by token only)
CREATE POLICY "Anyone can validate active sessions by token"
ON public.reception_translation_sessions
FOR SELECT
USING (is_active = true AND expires_at > now());

-- Create index for token lookups
CREATE INDEX idx_reception_sessions_token ON public.reception_translation_sessions(session_token);
CREATE INDEX idx_reception_sessions_active ON public.reception_translation_sessions(is_active, expires_at);