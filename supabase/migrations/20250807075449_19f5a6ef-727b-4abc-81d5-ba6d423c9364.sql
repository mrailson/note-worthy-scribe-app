-- Create storage bucket for meeting documents
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-documents', 'meeting-documents', false);

-- Create storage policies for meeting documents
CREATE POLICY "Users can view their own meeting documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'meeting-documents' 
  AND (storage.foldername(name))[1] IN (
    SELECT m.id::text 
    FROM public.meetings m 
    WHERE m.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload documents for their meetings"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'meeting-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT m.id::text 
    FROM public.meetings m 
    WHERE m.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own meeting documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'meeting-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT m.id::text 
    FROM public.meetings m 
    WHERE m.user_id = auth.uid()
  )
);