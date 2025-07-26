-- Ensure proper storage policies exist for practice logos
-- Allow authenticated users to upload and view practice logos

-- Policy for viewing logos (public access)
INSERT INTO storage.objects (bucket_id, name, owner, metadata) 
SELECT 'practice-logos', 'test', null, '{}' 
WHERE NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'practice-logos' LIMIT 1);

-- Remove test object if created
DELETE FROM storage.objects 
WHERE bucket_id = 'practice-logos' AND name = 'test';

-- Create policies for practice logos bucket
DO $$
BEGIN
  -- Policy to view practice logos (public)
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE bucket_id = 'practice-logos' 
    AND name = 'Allow public access to practice logos'
  ) THEN
    INSERT INTO storage.policies (bucket_id, name, definition, operation, types)
    VALUES (
      'practice-logos',
      'Allow public access to practice logos',
      'true',
      'SELECT',
      ARRAY['image/*']::text[]
    );
  END IF;

  -- Policy to upload practice logos (authenticated users)
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE bucket_id = 'practice-logos' 
    AND name = 'Allow authenticated users to upload practice logos'
  ) THEN
    INSERT INTO storage.policies (bucket_id, name, definition, operation, types)
    VALUES (
      'practice-logos',
      'Allow authenticated users to upload practice logos',
      'auth.role() = ''authenticated''',
      'INSERT',
      ARRAY['image/*']::text[]
    );
  END IF;

  -- Policy to update practice logos (authenticated users)
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE bucket_id = 'practice-logos' 
    AND name = 'Allow authenticated users to update practice logos'
  ) THEN
    INSERT INTO storage.policies (bucket_id, name, definition, operation, types)
    VALUES (
      'practice-logos',
      'Allow authenticated users to update practice logos',
      'auth.role() = ''authenticated''',
      'UPDATE',
      ARRAY['image/*']::text[]
    );
  END IF;

  -- Policy to delete practice logos (authenticated users)
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE bucket_id = 'practice-logos' 
    AND name = 'Allow authenticated users to delete practice logos'
  ) THEN
    INSERT INTO storage.policies (bucket_id, name, definition, operation, types)
    VALUES (
      'practice-logos',
      'Allow authenticated users to delete practice logos',
      'auth.role() = ''authenticated''',
      'DELETE',
      ARRAY['image/*']::text[]
    );
  END IF;
END $$;