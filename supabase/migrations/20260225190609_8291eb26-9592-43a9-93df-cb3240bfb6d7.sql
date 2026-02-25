
ALTER TABLE public.nres_buyback_claims
  ADD COLUMN IF NOT EXISTS submitted_by_email text,
  ADD COLUMN IF NOT EXISTS approved_by_email text;
