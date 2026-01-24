-- Create table to store reception translation messages for history
CREATE TABLE public.reception_translation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES reception_translation_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  speaker TEXT NOT NULL CHECK (speaker IN ('staff', 'patient')),
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX idx_reception_translation_messages_session_id ON public.reception_translation_messages(session_id);
CREATE INDEX idx_reception_translation_messages_user_id ON public.reception_translation_messages(user_id);
CREATE INDEX idx_reception_translation_messages_created_at ON public.reception_translation_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.reception_translation_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own messages
CREATE POLICY "Users can view their own translation messages"
ON public.reception_translation_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own messages
CREATE POLICY "Users can insert their own translation messages"
ON public.reception_translation_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete their own translation messages"
ON public.reception_translation_messages
FOR DELETE
USING (auth.uid() = user_id);

-- Add session title/notes to reception_translation_sessions for better history display
ALTER TABLE public.reception_translation_sessions
ADD COLUMN IF NOT EXISTS session_title TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0;