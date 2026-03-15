
INSERT INTO storage.buckets (id, name, public) VALUES ('user-logos', 'user-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own logos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'user-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view logos" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'user-logos');

CREATE POLICY "Users can delete own logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
