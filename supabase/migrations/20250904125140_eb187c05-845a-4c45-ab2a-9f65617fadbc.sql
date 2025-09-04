-- Remove all conflicting storage policies for communication-files
DROP POLICY IF EXISTS "Authenticated users can upload to communication-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view communication-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update communication-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete communication-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own communication files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own communication files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own communication files" ON storage.objects;

-- Create single comprehensive policy for communication-files bucket
CREATE POLICY "Communication files access for authenticated users" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id = 'communication-files' 
  AND auth.uid() IS NOT NULL
) 
WITH CHECK (
  bucket_id = 'communication-files' 
  AND auth.uid() IS NOT NULL
);