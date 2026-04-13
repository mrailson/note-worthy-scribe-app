
-- ============================================================
-- NRES Claims & Oversight — Per-Line Invoice Tables
-- ============================================================

-- 1. claim_lines — core table
CREATE TABLE public.claim_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_ref TEXT UNIQUE, -- auto-generated via trigger
  practice_id UUID NOT NULL REFERENCES public.gp_practices(id),
  claim_month DATE NOT NULL, -- first day of claim month
  staff_member TEXT NOT NULL,
  category TEXT NOT NULL,
  role TEXT NOT NULL,
  gl_code TEXT,
  allocation TEXT,
  start_date DATE,
  max_rate DECIMAL(10,2),
  claimed_amount DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'draft',

  -- Declaration
  declared_by TEXT, -- email of declarer
  declared_at TIMESTAMPTZ,
  declaration_text TEXT DEFAULT 'I declare the information provided is accurate and complete. The services described were delivered as stated.',

  -- On-behalf-of
  on_behalf_of TEXT, -- practice name if super admin submits

  -- Query handling
  query_note TEXT,
  queried_by TEXT, -- email
  queried_at TIMESTAMPTZ,

  -- Status tracking
  submitted_by TEXT, -- email
  submitted_at TIMESTAMPTZ,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  invoice_created_by TEXT,
  invoice_created_at TIMESTAMPTZ,
  scheduled_by TEXT,
  scheduled_at TIMESTAMPTZ,
  paid_by TEXT,
  paid_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Auto-generate claim_ref
CREATE OR REPLACE FUNCTION public.generate_claim_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  yr TEXT;
  seq INT;
BEGIN
  yr := TO_CHAR(NEW.claim_month, 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(claim_ref FROM 10) AS INT)
  ), 0) + 1 INTO seq
  FROM public.claim_lines
  WHERE claim_ref LIKE 'CLM-' || yr || '-%';
  NEW.claim_ref := 'CLM-' || yr || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_claim_ref
  BEFORE INSERT ON public.claim_lines
  FOR EACH ROW
  WHEN (NEW.claim_ref IS NULL)
  EXECUTE FUNCTION public.generate_claim_ref();

-- 3. Updated_at trigger
CREATE TRIGGER update_claim_lines_updated_at
  BEFORE UPDATE ON public.claim_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. claim_evidence
CREATE TABLE public.claim_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_line_id UUID NOT NULL REFERENCES public.claim_lines(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  uploaded_by TEXT, -- email
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 5. claim_audit_log
CREATE TABLE public.claim_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_line_id UUID NOT NULL REFERENCES public.claim_lines(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  performed_by TEXT, -- email
  performed_by_name TEXT,
  performed_by_role TEXT,
  on_behalf_of TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Security definer functions for RLS (avoid recursion)
CREATE OR REPLACE FUNCTION public.has_nres_claims_role(_user_email TEXT, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = lower(_user_email)
      AND role::text = _role
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_nres_admin_role(_user_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = lower(_user_email)
      AND role::text IN ('super_admin', 'management_lead')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_nres_claims_read_role(_user_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nres_system_roles
    WHERE user_email = lower(_user_email)
      AND role::text IN ('super_admin', 'management_lead', 'pml_director', 'pml_finance')
      AND is_active = true
  );
$$;

-- Helper: get user email from auth
CREATE OR REPLACE FUNCTION public.auth_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid();
$$;

-- 7. RLS on claim_lines
ALTER TABLE public.claim_lines ENABLE ROW LEVEL SECURITY;

-- Admin roles (super_admin, management_lead) = full access
CREATE POLICY "claims_admin_all" ON public.claim_lines
  FOR ALL TO authenticated
  USING (public.has_any_nres_admin_role(public.auth_email()))
  WITH CHECK (public.has_any_nres_admin_role(public.auth_email()));

-- PML Director (approver) = read all
CREATE POLICY "claims_approver_select" ON public.claim_lines
  FOR SELECT TO authenticated
  USING (public.has_nres_claims_role(public.auth_email(), 'pml_director'));

-- PML Director = update verified claims
CREATE POLICY "claims_approver_update" ON public.claim_lines
  FOR UPDATE TO authenticated
  USING (
    public.has_nres_claims_role(public.auth_email(), 'pml_director')
    AND status IN ('verified')
  )
  WITH CHECK (
    public.has_nres_claims_role(public.auth_email(), 'pml_director')
  );

-- PML Finance = read all
CREATE POLICY "claims_finance_select" ON public.claim_lines
  FOR SELECT TO authenticated
  USING (public.has_nres_claims_role(public.auth_email(), 'pml_finance'));

-- PML Finance = update approved/invoiced/scheduled
CREATE POLICY "claims_finance_update" ON public.claim_lines
  FOR UPDATE TO authenticated
  USING (
    public.has_nres_claims_role(public.auth_email(), 'pml_finance')
    AND status IN ('approved', 'invoice_created', 'scheduled')
  )
  WITH CHECK (
    public.has_nres_claims_role(public.auth_email(), 'pml_finance')
  );

-- Any authenticated user can read/write claims for practices they manage
-- (practice managers matched via gp_practices.practice_manager_name or similar)
-- For now: all authenticated users can insert draft claims and read their own
CREATE POLICY "claims_authenticated_insert" ON public.claim_lines
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "claims_authenticated_select_own" ON public.claim_lines
  FOR SELECT TO authenticated
  USING (
    submitted_by = public.auth_email()
    OR declared_by = public.auth_email()
  );

-- 8. RLS on claim_evidence
ALTER TABLE public.claim_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_admin_all" ON public.claim_evidence
  FOR ALL TO authenticated
  USING (public.has_any_nres_admin_role(public.auth_email()))
  WITH CHECK (public.has_any_nres_admin_role(public.auth_email()));

CREATE POLICY "evidence_read_all_roles" ON public.claim_evidence
  FOR SELECT TO authenticated
  USING (public.has_any_nres_claims_read_role(public.auth_email()));

CREATE POLICY "evidence_authenticated_insert" ON public.claim_evidence
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "evidence_authenticated_select_own" ON public.claim_evidence
  FOR SELECT TO authenticated
  USING (
    claim_line_id IN (
      SELECT id FROM public.claim_lines
      WHERE submitted_by = public.auth_email()
        OR declared_by = public.auth_email()
    )
  );

-- 9. RLS on claim_audit_log
ALTER TABLE public.claim_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_read" ON public.claim_audit_log
  FOR SELECT TO authenticated
  USING (public.has_any_nres_claims_read_role(public.auth_email()));

CREATE POLICY "audit_own_read" ON public.claim_audit_log
  FOR SELECT TO authenticated
  USING (
    claim_line_id IN (
      SELECT id FROM public.claim_lines
      WHERE submitted_by = public.auth_email()
        OR declared_by = public.auth_email()
    )
  );

CREATE POLICY "audit_insert" ON public.claim_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 10. Indexes
CREATE INDEX idx_claim_lines_practice ON public.claim_lines(practice_id);
CREATE INDEX idx_claim_lines_status ON public.claim_lines(status);
CREATE INDEX idx_claim_lines_claim_month ON public.claim_lines(claim_month);
CREATE INDEX idx_claim_lines_submitted_by ON public.claim_lines(submitted_by);
CREATE INDEX idx_claim_evidence_claim_line ON public.claim_evidence(claim_line_id);
CREATE INDEX idx_claim_audit_claim_line ON public.claim_audit_log(claim_line_id);

-- 11. Storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-evidence', 'claim-evidence', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "claim_evidence_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'claim-evidence');

CREATE POLICY "claim_evidence_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'claim-evidence');
