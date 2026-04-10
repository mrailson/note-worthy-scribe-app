-- Update the check constraint on nres_claim_evidence_config to allow 'management' category
ALTER TABLE public.nres_claim_evidence_config DROP CONSTRAINT IF EXISTS nres_claim_evidence_config_applies_to_check;
ALTER TABLE public.nres_claim_evidence_config ADD CONSTRAINT nres_claim_evidence_config_applies_to_check
  CHECK (applies_to = ANY (ARRAY['all'::text, 'buyback'::text, 'new_sda'::text, 'management'::text]));