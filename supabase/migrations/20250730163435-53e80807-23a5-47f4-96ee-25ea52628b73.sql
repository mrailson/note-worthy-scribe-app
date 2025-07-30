-- Create storage policies for shared-drive bucket

-- Allow users to upload files to their own folder
CREATE POLICY "Users can upload files to shared drive" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'shared-drive' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view files they have uploaded
CREATE POLICY "Users can view files in shared drive" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'shared-drive' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete files they have uploaded
CREATE POLICY "Users can delete their own files in shared drive" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'shared-drive' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update files they have uploaded
CREATE POLICY "Users can update their own files in shared drive" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'shared-drive' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);