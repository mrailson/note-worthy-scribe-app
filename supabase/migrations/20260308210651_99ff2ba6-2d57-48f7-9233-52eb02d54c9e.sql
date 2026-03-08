CREATE TABLE public.document_studio_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  practice_id UUID,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  version INTEGER DEFAULT 1,
  version_label TEXT DEFAULT 'v1.0',
  inputs_json JSONB,
  clarifying_answers_json JSONB,
  uploaded_file_refs JSONB,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.document_studio_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own documents"
  ON public.document_studio_documents
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);