
-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ── kb_categories ─────────────────────────────────────
CREATE TABLE public.kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  colour text NOT NULL DEFAULT '#005EB8',
  icon text NOT NULL DEFAULT '📄',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories"
  ON public.kb_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert categories"
  ON public.kb_categories FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins can update categories"
  ON public.kb_categories FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins can delete categories"
  ON public.kb_categories FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'system_admin'));

-- ── kb_documents ──────────────────────────────────────
CREATE TABLE public.kb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category_id uuid REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  source text,
  effective_date date,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  summary text,
  key_points text[],
  file_url text,
  file_type text DEFAULT 'pdf',
  status text NOT NULL DEFAULT 'processing',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view documents"
  ON public.kb_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert documents"
  ON public.kb_documents FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins can update documents"
  ON public.kb_documents FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins can delete documents"
  ON public.kb_documents FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'system_admin'));

CREATE INDEX idx_kb_documents_category ON public.kb_documents(category_id);
CREATE INDEX idx_kb_documents_status ON public.kb_documents(status);
CREATE INDEX idx_kb_documents_active ON public.kb_documents(is_active);

-- ── kb_chunks ─────────────────────────────────────────
CREATE TABLE public.kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.kb_documents(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  chunk_index int NOT NULL DEFAULT 0,
  embedding extensions.vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view chunks"
  ON public.kb_chunks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert chunks"
  ON public.kb_chunks FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins can update chunks"
  ON public.kb_chunks FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Admins can delete chunks"
  ON public.kb_chunks FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'system_admin'));

CREATE INDEX idx_kb_chunks_document ON public.kb_chunks(document_id);

-- ── Updated-at trigger for kb_documents ───────────────
CREATE TRIGGER update_kb_documents_updated_at
  BEFORE UPDATE ON public.kb_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ── Storage bucket ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can view KB files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'knowledge-base');

CREATE POLICY "Admins can upload KB files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-base'
    AND public.has_role(auth.uid(), 'system_admin')
  );

CREATE POLICY "Admins can delete KB files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'knowledge-base'
    AND public.has_role(auth.uid(), 'system_admin')
  );

-- ── Seed default categories ──────────────────────────
INSERT INTO public.kb_categories (name, colour, icon, sort_order) VALUES
  ('Formulary', '#2563eb', '📋', 1),
  ('Weekly Updates', '#16a34a', '📧', 2),
  ('PCN DES', '#7c3aed', '📄', 3),
  ('Local LES', '#ea580c', '📍', 4),
  ('Neighbourhood', '#0d9488', '🏘', 5),
  ('Governance / CQC', '#dc2626', '🏥', 6),
  ('Clinical Guidance', '#4f46e5', '💊', 7);
