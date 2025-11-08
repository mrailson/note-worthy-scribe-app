-- Ensure private bucket for complaint evidence exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'communication-files'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('communication-files', 'communication-files', false);
  END IF;
END $$;

-- Allow authenticated users to upload, read, update, and delete objects in this bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can upload communication files'
  ) THEN
    CREATE POLICY "Authenticated can upload communication files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'communication-files');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can read communication files'
  ) THEN
    CREATE POLICY "Authenticated can read communication files"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'communication-files');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can update communication files'
  ) THEN
    CREATE POLICY "Authenticated can update communication files"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'communication-files');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can delete communication files'
  ) THEN
    CREATE POLICY "Authenticated can delete communication files"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'communication-files');
  END IF;
END $$;
