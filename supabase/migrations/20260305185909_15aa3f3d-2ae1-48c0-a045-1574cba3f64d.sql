
-- 1. Create nres_claim_evidence_config table
CREATE TABLE public.nres_claim_evidence_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evidence_type TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'buyback')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create nres_claim_evidence table
CREATE TABLE public.nres_claim_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES public.nres_buyback_claims(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  evidence_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Add verified status columns to nres_buyback_claims
ALTER TABLE public.nres_buyback_claims
  ADD COLUMN IF NOT EXISTS verified_by TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_notes TEXT;

-- 4. Enable RLS
ALTER TABLE public.nres_claim_evidence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nres_claim_evidence ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for evidence config (read by all authenticated, write by admins via service role)
CREATE POLICY "Anyone can read evidence config"
  ON public.nres_claim_evidence_config
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update evidence config"
  ON public.nres_claim_evidence_config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. RLS policies for claim evidence
CREATE POLICY "Users can read evidence for their claims or admins"
  ON public.nres_claim_evidence
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert evidence"
  ON public.nres_claim_evidence
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evidence"
  ON public.nres_claim_evidence
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. Seed evidence config
INSERT INTO public.nres_claim_evidence_config (evidence_type, label, description, is_mandatory, applies_to, sort_order) VALUES
  ('sda_slot_type', 'SDA Slot Type Report', 'Report showing appointment types coded as SDA for the clinician', true, 'all', 1),
  ('sda_rota', 'SDA Rota Report', 'Report showing sessions during which the clinician provides SDA activity', true, 'all', 2),
  ('ltc_slot_type', 'LTC Slot Type Report', 'Report showing LTC appointment types delivered as matching Part B output', true, 'buyback', 3),
  ('ltc_rota', 'LTC Rota Report', 'Report showing new LTC sessions added to the rota as a result of the buy-back', true, 'buyback', 4);

-- 8. Create storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('nres-claim-evidence', 'nres-claim-evidence', false, 31457280)
ON CONFLICT (id) DO NOTHING;

-- 9. Storage policies
CREATE POLICY "Authenticated users can upload evidence"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'nres-claim-evidence');

CREATE POLICY "Authenticated users can read evidence"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'nres-claim-evidence');

CREATE POLICY "Users can delete their own evidence files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'nres-claim-evidence');
