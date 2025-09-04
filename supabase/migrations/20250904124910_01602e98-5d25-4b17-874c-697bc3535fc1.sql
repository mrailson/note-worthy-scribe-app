-- Update storage policies to be more comprehensive
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects; 
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create comprehensive storage policies for communication-files bucket
CREATE POLICY "Authenticated users can upload to communication-files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'communication-files' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can view communication-files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'communication-files' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update communication-files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'communication-files' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete communication-files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'communication-files' 
  AND auth.uid() IS NOT NULL
);