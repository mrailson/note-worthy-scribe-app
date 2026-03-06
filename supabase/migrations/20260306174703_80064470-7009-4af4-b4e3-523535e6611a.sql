
-- Create quick-guides storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('quick-guides', 'quick-guides', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can upload their own guides
CREATE POLICY "Users can upload quick guides"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'quick-guides' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can read their own guides
CREATE POLICY "Users can read own quick guides"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'quick-guides' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can delete their own guides
CREATE POLICY "Users can delete own quick guides"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'quick-guides' AND (storage.foldername(name))[1] = auth.uid()::text);
