-- Create storage bucket for presentation logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('presentation-logos', 'presentation-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own logos
CREATE POLICY "Users can upload their own presentation logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'presentation-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own logos
CREATE POLICY "Users can update their own presentation logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'presentation-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own logos
CREATE POLICY "Users can delete their own presentation logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'presentation-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to logos (needed for embedding in presentations)
CREATE POLICY "Presentation logos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'presentation-logos');