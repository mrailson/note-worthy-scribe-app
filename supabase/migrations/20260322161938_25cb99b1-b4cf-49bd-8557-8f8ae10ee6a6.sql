
-- Create "recordings" storage bucket for offline recorder uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload their own recordings
CREATE POLICY "Users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recordings');

-- RLS: authenticated users can read their own recordings
CREATE POLICY "Users can read own recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'recordings');

-- RLS: authenticated users can update their own recordings
CREATE POLICY "Users can update own recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'recordings');

-- RLS: authenticated users can delete their own recordings
CREATE POLICY "Users can delete own recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'recordings');
