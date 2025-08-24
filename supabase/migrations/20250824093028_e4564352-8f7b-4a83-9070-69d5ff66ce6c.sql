-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pdfs', 'pdfs', true);

-- Create RLS policies for PDF uploads
CREATE POLICY "Anyone can view PDF files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'pdfs');

CREATE POLICY "Authenticated users can upload PDFs" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'pdfs' 
  AND auth.uid() IS NOT NULL
  AND (storage.extension(name) = 'pdf')
);