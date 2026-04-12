
-- Add payment workflow columns to nres_buyback_claims
ALTER TABLE public.nres_buyback_claims
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pml_po_reference text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bacs_reference text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expected_payment_date text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_payment_date text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_audit_trail jsonb DEFAULT '[]'::jsonb;
