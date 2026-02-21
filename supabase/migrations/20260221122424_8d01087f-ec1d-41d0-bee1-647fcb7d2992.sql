
-- audio_import_sessions: tracks QR-based audio import sessions
CREATE TABLE public.audio_import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_token UUID NOT NULL DEFAULT gen_random_uuid(),
  short_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_audio_import_sessions_token ON public.audio_import_sessions(session_token);
CREATE UNIQUE INDEX idx_audio_import_sessions_short_code ON public.audio_import_sessions(short_code);

ALTER TABLE public.audio_import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audio import sessions"
  ON public.audio_import_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own audio import sessions"
  ON public.audio_import_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audio import sessions"
  ON public.audio_import_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audio import sessions"
  ON public.audio_import_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- audio_import_uploads: tracks individual file uploads
CREATE TABLE public.audio_import_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.audio_import_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audio_import_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audio import uploads"
  ON public.audio_import_uploads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.audio_import_sessions s
      WHERE s.id = audio_import_uploads.session_id
      AND s.user_id = auth.uid()
    )
  );

-- Enable Realtime for audio_import_uploads
ALTER PUBLICATION supabase_realtime ADD TABLE public.audio_import_uploads;

-- Storage read policy for existing audio-imports bucket
CREATE POLICY "Users can read their own audio imports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audio-imports'
    AND EXISTS (
      SELECT 1 FROM public.audio_import_sessions s
      WHERE s.id::text = (storage.foldername(name))[1]
      AND s.user_id = auth.uid()
    )
  );
