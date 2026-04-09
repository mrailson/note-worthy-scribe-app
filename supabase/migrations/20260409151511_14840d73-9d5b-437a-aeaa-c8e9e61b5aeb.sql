
-- Update the applies_to constraint to include 'new_sda'
ALTER TABLE public.nres_claim_evidence_config 
  DROP CONSTRAINT IF EXISTS nres_claim_evidence_config_applies_to_check;

ALTER TABLE public.nres_claim_evidence_config 
  ADD CONSTRAINT nres_claim_evidence_config_applies_to_check 
  CHECK (applies_to IN ('all', 'buyback', 'new_sda'));

-- Seed new evidence types
INSERT INTO public.nres_claim_evidence_config (evidence_type, label, description, applies_to, is_mandatory, sort_order)
VALUES
  ('employment_agreement', 'Employment Agreement', 'Offer letter or signed employment contract for the SDA role', 'new_sda', true, 10),
  ('payslip', 'Payslip (redacted OK)', 'Payslip confirming employment and cost basis — personal details may be redacted', 'all', true, 11),
  ('professional_registration', 'Professional Registration', 'GMC, NMC, or HCPC registration confirmation for the clinician', 'new_sda', true, 12),
  ('contract_variation', 'Contract / Allocation Letter', 'Contract variation or letter confirming the SDA buy-back allocation and terms', 'buyback', false, 13),
  ('other_supporting', 'Other Supporting Evidence', 'Any additional documentation to support the claim', 'all', false, 20)
ON CONFLICT (evidence_type) DO NOTHING;
