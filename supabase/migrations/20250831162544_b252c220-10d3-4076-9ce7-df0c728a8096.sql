-- Create storage bucket for user images (including QR codes)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user_images', 'user_images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for user images bucket
CREATE POLICY "User images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'user_images');

CREATE POLICY "Users can upload their own images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'user_images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'user_images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'user_images' AND auth.uid()::text = (storage.foldername(name))[1]);