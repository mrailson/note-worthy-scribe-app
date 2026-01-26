-- Create translation_documents table for storing imported/captured documents
CREATE TABLE public.translation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.reception_translation_sessions(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT,
  thumbnail_url TEXT,
  original_text TEXT,
  translated_text TEXT,
  detected_language TEXT,
  clinical_verification JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'error')),
  error_message TEXT,
  uploaded_by TEXT DEFAULT 'clinician' CHECK (uploaded_by IN ('clinician', 'patient')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.translation_documents ENABLE ROW LEVEL SECURITY;

-- Users can manage documents in their sessions
CREATE POLICY "Users can manage own session documents"
  ON public.translation_documents FOR ALL
  USING (session_id IN (
    SELECT id FROM public.reception_translation_sessions WHERE user_id = auth.uid()
  ));

-- Create storage bucket for translation documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('translation-documents', 'translation-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Session owners can upload documents
CREATE POLICY "Session owners can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'translation-documents' 
    AND auth.uid() IS NOT NULL
  );

-- Storage policy: Session owners can read their documents  
CREATE POLICY "Session owners can read documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'translation-documents' 
    AND auth.uid() IS NOT NULL
  );

-- Storage policy: Session owners can delete their documents
CREATE POLICY "Session owners can delete documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'translation-documents' 
    AND auth.uid() IS NOT NULL
  );

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION public.update_translation_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_translation_documents_updated_at
  BEFORE UPDATE ON public.translation_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_translation_document_timestamp();