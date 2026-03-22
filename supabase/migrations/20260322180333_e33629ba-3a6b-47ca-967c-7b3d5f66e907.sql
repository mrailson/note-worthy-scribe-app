-- Ensure the recordings bucket exists with correct settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recordings',
  'recordings',
  false,
  52428800,
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
)
ON CONFLICT (id) DO NOTHING;