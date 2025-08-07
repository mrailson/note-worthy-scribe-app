-- Create storage policy for meeting audio segments to allow public access for authenticated users
CREATE POLICY "Allow public access to meeting audio segments for auth users" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'meeting-audio-segments' AND auth.uid() IS NOT NULL);

-- Allow users to upload their own meeting audio segments
CREATE POLICY "Users can upload their own meeting audio segments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'meeting-audio-segments' AND auth.uid()::text = (storage.foldername(name))[1]);