-- Create private bucket for meeting documents (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-documents', 'meeting-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload to their own folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Users can upload to their own folder (meeting-documents)'
  ) THEN
    CREATE POLICY "Users can upload to their own folder (meeting-documents)"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'meeting-documents'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Policy: Owners can update their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Users can update their own files (meeting-documents)'
  ) THEN
    CREATE POLICY "Users can update their own files (meeting-documents)"
    ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'meeting-documents'
      AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
      bucket_id = 'meeting-documents'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Policy: Owners can delete their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Users can delete their own files (meeting-documents)'
  ) THEN
    CREATE POLICY "Users can delete their own files (meeting-documents)"
    ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'meeting-documents'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Policy: Allow read (download) to owners, and to users who have access to the meeting (via path segment 3)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Users can read their files or accessible meetings (meeting-documents)'
  ) THEN
    CREATE POLICY "Users can read their files or accessible meetings (meeting-documents)"
    ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'meeting-documents' AND (
        auth.uid()::text = (storage.foldername(name))[1]
        OR (
          array_length(storage.foldername(name), 1) >= 3
          AND public.user_has_meeting_access(((storage.foldername(name))[3])::uuid, auth.uid())
        )
      )
    );
  END IF;
END $$;