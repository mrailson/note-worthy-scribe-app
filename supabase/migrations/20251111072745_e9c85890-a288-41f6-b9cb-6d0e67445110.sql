-- Create public storage bucket for demo videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'demo-videos',
  'demo-videos',
  true,
  52428800, -- 50MB limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
);

-- Allow public read access to demo videos
CREATE POLICY "Public read access for demo videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'demo-videos');

-- Allow authenticated users to upload demo videos (admin only in practice)
CREATE POLICY "Authenticated users can upload demo videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'demo-videos');