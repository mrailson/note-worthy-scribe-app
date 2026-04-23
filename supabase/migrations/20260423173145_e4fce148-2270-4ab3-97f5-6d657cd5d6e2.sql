
-- Create public storage bucket for NHC reference layout images
INSERT INTO storage.buckets (id, name, public)
VALUES ('nhc-reference-layouts', 'nhc-reference-layouts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "NHC layout images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'nhc-reference-layouts');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload NHC layouts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'nhc-reference-layouts');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update NHC layouts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'nhc-reference-layouts');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete NHC layouts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'nhc-reference-layouts');
