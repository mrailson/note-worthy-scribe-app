-- Create gladia_transcriptions table mirroring deepgram_transcriptions schema
CREATE TABLE public.gladia_transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id text NOT NULL,
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  chunk_number integer NOT NULL,
  transcription_text text NOT NULL,
  confidence real DEFAULT 0,
  is_final boolean DEFAULT true,
  word_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_gladia_transcriptions_meeting_id ON public.gladia_transcriptions(meeting_id);
CREATE INDEX idx_gladia_transcriptions_user_id ON public.gladia_transcriptions(user_id);

ALTER TABLE public.gladia_transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own gladia transcriptions"
  ON public.gladia_transcriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gladia transcriptions"
  ON public.gladia_transcriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gladia transcriptions"
  ON public.gladia_transcriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gladia transcriptions"
  ON public.gladia_transcriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);