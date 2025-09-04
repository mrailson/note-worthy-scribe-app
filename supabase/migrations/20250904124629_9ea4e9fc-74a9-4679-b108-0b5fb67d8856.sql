-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('communication-files', 'communication-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for communication files
CREATE POLICY "Users can upload their own files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'communication-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'communication-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'communication-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'communication-files' AND auth.uid() IS NOT NULL);