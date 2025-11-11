-- Create storage bucket for AI4PM speech files
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai4pm-speech', 'ai4pm-speech', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload their own speech files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai4pm-speech' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can read their own files
CREATE POLICY "Users can read their own speech files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai4pm-speech' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own speech files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ai4pm-speech' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update their own speech files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ai4pm-speech' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Public read access for all speech files (needed for public URLs)
CREATE POLICY "Public read access for ai4pm speech files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'ai4pm-speech');