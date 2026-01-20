-- Create storage bucket for large audio file imports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-imports', 
  'audio-imports', 
  false,
  104857600, -- 100MB limit
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/m4a', 'audio/mp4', 'audio/x-m4a']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their temp folder
CREATE POLICY "Users can upload audio for transcription"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-imports' AND (storage.foldername(name))[1] = 'temp');

-- Allow service role to read and delete (for edge function)
CREATE POLICY "Service role can read audio imports"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'audio-imports');

CREATE POLICY "Service role can delete audio imports"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'audio-imports');