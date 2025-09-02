-- Create storage bucket for meeting files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-files',
  'meeting-files',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg', 'image/png', 'image/gif', 'text/plain']
);

-- Create RLS policies for meeting files bucket
CREATE POLICY "Meeting owners can upload files to their meetings" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'meeting-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Meeting owners can view their meeting files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'meeting-files' 
  AND EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.user_id = auth.uid() 
    AND m.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Meeting owners can update their meeting files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'meeting-files' 
  AND EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.user_id = auth.uid() 
    AND m.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Meeting owners can delete their meeting files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'meeting-files' 
  AND EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.user_id = auth.uid() 
    AND m.id::text = (storage.foldername(name))[1]
  )
);