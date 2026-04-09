
-- 2a. Extend status CHECK constraint
ALTER TABLE public.nres_buyback_claims 
  DROP CONSTRAINT IF EXISTS nres_buyback_claims_status_check;

ALTER TABLE public.nres_buyback_claims 
  ADD CONSTRAINT nres_buyback_claims_status_check 
  CHECK (status IN ('draft', 'submitted', 'verified', 'approved', 'queried', 'invoiced', 'paid', 'rejected'));

-- 2b. Add invoice fields
ALTER TABLE public.nres_buyback_claims
  ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invoice_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gl_summary JSONB;

-- 2c. Add query and payment tracking fields
ALTER TABLE public.nres_buyback_claims
  ADD COLUMN IF NOT EXISTS queried_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queried_by TEXT,
  ADD COLUMN IF NOT EXISTS query_notes TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by TEXT;

-- 2d. Update RLS policies
DROP POLICY IF EXISTS "Approvers can update submitted buyback claims" ON public.nres_buyback_claims;
DROP POLICY IF EXISTS "Approvers can view submitted buyback claims" ON public.nres_buyback_claims;
DROP POLICY IF EXISTS "Users can delete own draft buyback claims" ON public.nres_buyback_claims;
DROP POLICY IF EXISTS "Admins can update all non-draft buyback claims" ON public.nres_buyback_claims;
DROP POLICY IF EXISTS "Admins can view all buyback claims" ON public.nres_buyback_claims;
DROP POLICY IF EXISTS "Admins can delete draft buyback claims" ON public.nres_buyback_claims;

CREATE POLICY "Admins can update all non-draft buyback claims"
  ON public.nres_buyback_claims FOR UPDATE
  USING (public.is_nres_admin())
  WITH CHECK (public.is_nres_admin());

CREATE POLICY "Admins can view all buyback claims"
  ON public.nres_buyback_claims FOR SELECT
  USING (public.is_nres_admin());

CREATE POLICY "Users can delete own draft buyback claims"
  ON public.nres_buyback_claims FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "Admins can delete draft buyback claims"
  ON public.nres_buyback_claims FOR DELETE
  USING (public.is_nres_admin() AND status = 'draft');
