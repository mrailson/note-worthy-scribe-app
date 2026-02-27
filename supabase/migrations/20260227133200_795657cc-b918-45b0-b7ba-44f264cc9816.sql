-- Add SELECT policy for NRES vault files in shared-drive bucket
CREATE POLICY "Authenticated users can view nres-vault files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'shared-drive'
  AND (storage.foldername(name))[1] = 'nres-vault'
  AND auth.role() = 'authenticated'
);

-- Add signed URL support (sign requires SELECT access, which the above provides)
