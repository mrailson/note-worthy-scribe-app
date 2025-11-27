-- Create audio_overview_sessions table for saving audio history
CREATE TABLE IF NOT EXISTS public.audio_overview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  original_script TEXT NOT NULL,
  edited_script TEXT,
  audio_url TEXT,
  voice_id TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  duration_seconds INTEGER,
  word_count INTEGER NOT NULL,
  source_documents JSONB DEFAULT '[]'::jsonb,
  pronunciation_rules JSONB DEFAULT '[]'::jsonb,
  target_duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audio_overview_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own audio sessions" ON public.audio_overview_sessions;
DROP POLICY IF EXISTS "Users can create their own audio sessions" ON public.audio_overview_sessions;
DROP POLICY IF EXISTS "Users can update their own audio sessions" ON public.audio_overview_sessions;
DROP POLICY IF EXISTS "Users can delete their own audio sessions" ON public.audio_overview_sessions;

-- Create policies for authenticated users to manage their own sessions
CREATE POLICY "Users can view their own audio sessions"
  ON public.audio_overview_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own audio sessions"
  ON public.audio_overview_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audio sessions"
  ON public.audio_overview_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audio sessions"
  ON public.audio_overview_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS public.idx_audio_sessions_user_id;
DROP INDEX IF EXISTS public.idx_audio_sessions_created_at;

-- Create indexes for faster queries
CREATE INDEX idx_audio_sessions_user_id ON public.audio_overview_sessions(user_id);
CREATE INDEX idx_audio_sessions_created_at ON public.audio_overview_sessions(created_at DESC);

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_audio_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_audio_sessions_updated_at ON public.audio_overview_sessions;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_audio_sessions_updated_at
  BEFORE UPDATE ON public.audio_overview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_audio_sessions_updated_at();