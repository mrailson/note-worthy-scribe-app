-- Create RLS policies for meeting-audio-segments storage bucket
-- Users can view their own meeting audio files
CREATE POLICY "Users can view their own meeting audio files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'meeting-audio-segments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can upload their own meeting audio files
CREATE POLICY "Users can upload their own meeting audio files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'meeting-audio-segments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own meeting audio files
CREATE POLICY "Users can update their own meeting audio files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'meeting-audio-segments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own meeting audio files
CREATE POLICY "Users can delete their own meeting audio files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'meeting-audio-segments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);