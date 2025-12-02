-- Create the lg storage bucket for Lloyd George records
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lg',
  'lg',
  false,
  20971520, -- 20MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the lg bucket
-- Policy for authenticated users to upload to their patient folders
CREATE POLICY "Authenticated users can upload lg images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lg');

-- Policy for authenticated users to read their uploads
CREATE POLICY "Authenticated users can read lg images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'lg');

-- Policy for authenticated users to update their uploads
CREATE POLICY "Authenticated users can update lg images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'lg');

-- Policy for authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete lg images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'lg');