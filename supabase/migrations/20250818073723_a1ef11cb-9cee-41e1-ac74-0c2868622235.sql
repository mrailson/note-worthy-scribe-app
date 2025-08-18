-- Create storage bucket for reference images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reference-images', 'reference-images', true);

-- Create RLS policies for reference images bucket
CREATE POLICY "Allow authenticated users to upload reference images" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'reference-images');

CREATE POLICY "Allow public access to reference images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'reference-images');

CREATE POLICY "Allow users to delete their own reference images" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (bucket_id = 'reference-images' AND auth.uid()::text = (storage.foldername(name))[1]);