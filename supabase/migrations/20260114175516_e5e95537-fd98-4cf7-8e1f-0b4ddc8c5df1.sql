-- Add claimant_type and claimant_name columns to nres_hours_entries
-- claimant_type: NULL means use personal rate, 'gp' = £100/hr, 'pm' = £50/hr
ALTER TABLE public.nres_hours_entries
ADD COLUMN claimant_type TEXT CHECK (claimant_type IN ('gp', 'pm') OR claimant_type IS NULL),
ADD COLUMN claimant_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.nres_hours_entries.claimant_type IS 'Type of claimant: gp (£100/hr), pm (£50/hr), or NULL for personal rate';
COMMENT ON COLUMN public.nres_hours_entries.claimant_name IS 'Name of person being claimed for (free text)';