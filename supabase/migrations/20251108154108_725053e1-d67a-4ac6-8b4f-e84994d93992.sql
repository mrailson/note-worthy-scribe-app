-- Create storage bucket for investigation evidence files if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('communication-files', 'communication-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for communication-files bucket

-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload investigation evidence files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'communication-files' 
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to view files in their practice
CREATE POLICY "Users can view investigation evidence files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'communication-files'
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to delete files they uploaded
CREATE POLICY "Users can delete their own investigation evidence files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'communication-files'
  AND auth.uid() = owner
);

-- Allow authenticated users to update files they uploaded
CREATE POLICY "Users can update their own investigation evidence files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'communication-files'
  AND auth.uid() = owner
);