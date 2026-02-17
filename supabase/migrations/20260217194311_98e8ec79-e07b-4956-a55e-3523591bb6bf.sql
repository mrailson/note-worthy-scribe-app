
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can update their meeting audio backups' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their meeting audio backups"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = ''meeting-audio-backups''
        AND (auth.uid())::text = (storage.foldername(name))[1]
      )';
  END IF;
END $$;
