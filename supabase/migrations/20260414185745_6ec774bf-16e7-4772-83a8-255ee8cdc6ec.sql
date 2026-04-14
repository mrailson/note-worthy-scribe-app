DROP POLICY IF EXISTS "Users can upload audio for transcription" ON storage.objects;

CREATE POLICY "Users can upload audio for transcription" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'audio-imports' 
  AND (
    (storage.foldername(name))[1] = 'temp'
    OR (storage.foldername(name))[1] = 'temp-transcribe'
  )
);