-- Sequence starting at 100
CREATE SEQUENCE IF NOT EXISTS public.nres_buyback_claims_claim_ref_seq START WITH 100 INCREMENT BY 1;

-- Add column with default from sequence
ALTER TABLE public.nres_buyback_claims
  ADD COLUMN IF NOT EXISTS claim_ref integer;

-- Backfill existing rows in created_at order, starting at 100
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1 AS rn
  FROM public.nres_buyback_claims
  WHERE claim_ref IS NULL
)
UPDATE public.nres_buyback_claims c
SET claim_ref = 100 + ordered.rn
FROM ordered
WHERE c.id = ordered.id;

-- Advance sequence past any backfilled values so future inserts don't collide
SELECT setval(
  'public.nres_buyback_claims_claim_ref_seq',
  GREATEST(100, COALESCE((SELECT MAX(claim_ref) FROM public.nres_buyback_claims), 99) + 1),
  false
);

-- Set default and constraints
ALTER TABLE public.nres_buyback_claims
  ALTER COLUMN claim_ref SET DEFAULT nextval('public.nres_buyback_claims_claim_ref_seq');

ALTER TABLE public.nres_buyback_claims
  ALTER COLUMN claim_ref SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nres_buyback_claims_claim_ref_unique
  ON public.nres_buyback_claims (claim_ref);

-- Tie sequence ownership to the column
ALTER SEQUENCE public.nres_buyback_claims_claim_ref_seq OWNED BY public.nres_buyback_claims.claim_ref;