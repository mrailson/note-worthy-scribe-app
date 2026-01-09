-- Create storage bucket for AI4PM generated assets (images, presentations, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai4pm-assets', 'ai4pm-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Users can upload to their own folder
CREATE POLICY "Users can upload own ai4pm assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai4pm-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS policy: Users can view their own assets
CREATE POLICY "Users can view own ai4pm assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai4pm-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS policy: Public read access for shared assets (presentations can be shared)
CREATE POLICY "Public read for ai4pm assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'ai4pm-assets');

-- RLS policy: Users can delete their own assets
CREATE POLICY "Users can delete own ai4pm assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ai4pm-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);