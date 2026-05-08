ALTER TABLE public.nres_buyback_claims
  ADD COLUMN IF NOT EXISTS actual_cost_incurred numeric,
  ADD COLUMN IF NOT EXISTS actual_cost_notes text;

CREATE OR REPLACE VIEW public.nres_buyback_overspend_v
WITH (security_invoker = true) AS
SELECT
  id AS claim_id,
  claim_ref,
  claim_month,
  practice_key,
  claim_type,
  status,
  calculated_amount AS max_reclaimable,
  claimed_amount,
  actual_cost_incurred,
  (actual_cost_incurred - calculated_amount) AS overspend_amount,
  actual_cost_notes,
  submitted_by_email,
  submitted_at
FROM public.nres_buyback_claims
WHERE actual_cost_incurred IS NOT NULL
  AND calculated_amount IS NOT NULL
  AND actual_cost_incurred > calculated_amount;