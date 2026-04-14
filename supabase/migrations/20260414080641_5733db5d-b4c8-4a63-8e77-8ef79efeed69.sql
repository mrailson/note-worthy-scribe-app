
-- Add claim_type to the claims table
ALTER TABLE public.nres_buyback_claims 
ADD COLUMN IF NOT EXISTS claim_type TEXT NOT NULL DEFAULT 'buyback' 
CHECK (claim_type IN ('buyback', 'additional'));
