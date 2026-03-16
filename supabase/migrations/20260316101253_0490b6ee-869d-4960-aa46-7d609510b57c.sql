-- Create nres-reports storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('nres-reports', 'nres-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read from the bucket
CREATE POLICY "Public read access on nres-reports"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'nres-reports');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload to nres-reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'nres-reports');