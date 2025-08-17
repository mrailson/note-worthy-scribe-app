-- Fix the RLS policies for image-processing bucket
DROP POLICY IF EXISTS "Authenticated users can upload images for processing" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own uploaded images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploaded images" ON storage.objects;

-- Create proper RLS policies for the image-processing bucket
CREATE POLICY "Users can upload images to their own folder" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'image-processing' 
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view images in their own folder" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'image-processing' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete images from their own folder" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'image-processing' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Also make the bucket public for easier access (but still protected by RLS)
UPDATE storage.buckets SET public = true WHERE id = 'image-processing';