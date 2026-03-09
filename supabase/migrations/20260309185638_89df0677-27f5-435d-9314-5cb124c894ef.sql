
-- 1. approval_documents
CREATE TABLE public.approval_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  sender_name TEXT,
  sender_email TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other' CHECK (category IN ('dpia', 'dsa', 'mou', 'policy', 'contract', 'privacy_notice', 'other')),
  file_url TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size_bytes BIGINT,
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'completed', 'revoked', 'expired')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE public.approval_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents" ON public.approval_documents
  FOR SELECT TO authenticated USING (sender_id = auth.uid());

CREATE POLICY "Users can insert own documents" ON public.approval_documents
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update own documents" ON public.approval_documents
  FOR UPDATE TO authenticated USING (sender_id = auth.uid());

CREATE POLICY "Users can delete own documents" ON public.approval_documents
  FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- 2. approval_signatories
CREATE TABLE public.approval_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.approval_documents(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  organisation TEXT,
  approval_token UUID DEFAULT gen_random_uuid() UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'expired')),
  signed_at TIMESTAMPTZ,
  signed_name TEXT,
  signed_role TEXT,
  signed_organisation TEXT,
  signed_ip TEXT,
  signed_user_agent TEXT,
  decline_comment TEXT,
  reminder_count INT DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  sort_order INT DEFAULT 0
);

ALTER TABLE public.approval_signatories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view signatories for own documents" ON public.approval_signatories
  FOR SELECT TO authenticated USING (
    document_id IN (SELECT id FROM public.approval_documents WHERE sender_id = auth.uid())
  );

CREATE POLICY "Users can insert signatories for own documents" ON public.approval_signatories
  FOR INSERT TO authenticated WITH CHECK (
    document_id IN (SELECT id FROM public.approval_documents WHERE sender_id = auth.uid())
  );

CREATE POLICY "Users can update signatories for own documents" ON public.approval_signatories
  FOR UPDATE TO authenticated USING (
    document_id IN (SELECT id FROM public.approval_documents WHERE sender_id = auth.uid())
  );

CREATE POLICY "Users can delete signatories for own documents" ON public.approval_signatories
  FOR DELETE TO authenticated USING (
    document_id IN (SELECT id FROM public.approval_documents WHERE sender_id = auth.uid())
  );

-- Allow anonymous access by token for the public approval page
CREATE POLICY "Public can view by approval token" ON public.approval_signatories
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public can update by approval token" ON public.approval_signatories
  FOR UPDATE TO anon USING (true);

-- 3. approval_audit_log (append only)
CREATE TABLE public.approval_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.approval_documents(id),
  signatory_id UUID REFERENCES public.approval_signatories(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'sent', 'viewed', 'approved', 'declined', 'reminded', 'revoked', 'expired', 'completed')),
  actor_name TEXT,
  actor_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.approval_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit log for own documents" ON public.approval_audit_log
  FOR SELECT TO authenticated USING (
    document_id IN (SELECT id FROM public.approval_documents WHERE sender_id = auth.uid())
  );

CREATE POLICY "Authenticated users can insert audit entries" ON public.approval_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anon can insert audit entries" ON public.approval_audit_log
  FOR INSERT TO anon WITH CHECK (true);

-- No update or delete policies - append only

-- 4. approval_contacts
CREATE TABLE public.approval_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  organisation TEXT,
  is_favourite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);

ALTER TABLE public.approval_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contacts" ON public.approval_contacts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_approval_signatories_token ON public.approval_signatories(approval_token);
CREATE INDEX idx_approval_signatories_document ON public.approval_signatories(document_id);
CREATE INDEX idx_approval_documents_sender_status ON public.approval_documents(sender_id, status);
CREATE INDEX idx_approval_documents_created ON public.approval_documents(created_at DESC);
CREATE INDEX idx_approval_audit_log_document ON public.approval_audit_log(document_id, created_at);
CREATE INDEX idx_approval_contacts_user ON public.approval_contacts(user_id);

-- Storage bucket for approval documents
INSERT INTO storage.buckets (id, name, public) VALUES ('approval-documents', 'approval-documents', true);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload approval documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'approval-documents');

CREATE POLICY "Anyone can read approval documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'approval-documents');

CREATE POLICY "Users can delete own approval documents" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'approval-documents');
