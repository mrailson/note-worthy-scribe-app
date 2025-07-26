-- Create storage policies for practice logos bucket using the correct approach

-- Policy to allow public read access to practice logos
CREATE POLICY "Public read access for practice logos" ON storage.objects
FOR SELECT USING (bucket_id = 'practice-logos');

-- Policy to allow authenticated users to upload practice logos  
CREATE POLICY "Authenticated users can upload practice logos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'practice-logos' 
  AND auth.role() = 'authenticated'
);

-- Policy to allow authenticated users to update their practice logos
CREATE POLICY "Authenticated users can update practice logos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'practice-logos' 
  AND auth.role() = 'authenticated'
);

-- Policy to allow authenticated users to delete their practice logos
CREATE POLICY "Authenticated users can delete practice logos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'practice-logos' 
  AND auth.role() = 'authenticated'
);