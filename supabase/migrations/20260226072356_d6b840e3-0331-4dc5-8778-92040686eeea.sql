-- Add separate employer NI and pension percentage columns
ALTER TABLE public.nres_buyback_rate_settings
  ADD COLUMN IF NOT EXISTS employer_ni_pct NUMERIC NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS employer_pension_pct NUMERIC NOT NULL DEFAULT 14.38;

-- Update existing row with the split values (total stays 29.38%)
UPDATE public.nres_buyback_rate_settings
SET employer_ni_pct = 15,
    employer_pension_pct = 14.38
WHERE id = 'default';