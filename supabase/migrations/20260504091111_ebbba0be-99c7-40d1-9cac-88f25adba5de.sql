ALTER TABLE public.user_document_settings
  ADD COLUMN IF NOT EXISTS transcription_engine TEXT NOT NULL DEFAULT 'whisper-1';

ALTER TABLE public.user_document_settings
  DROP CONSTRAINT IF EXISTS user_document_settings_transcription_engine_check;

ALTER TABLE public.user_document_settings
  ADD CONSTRAINT user_document_settings_transcription_engine_check
  CHECK (transcription_engine IN ('whisper-1', 'gpt-4o-transcribe'));