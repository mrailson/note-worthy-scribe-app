-- Add previous_names column for tracking maiden/married names
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS previous_names jsonb DEFAULT '[]'::jsonb;

-- Add identity verification columns
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS identity_verification_status text DEFAULT 'pending';

ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS identity_verification_issues jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS nhs_number_validated boolean DEFAULT false;

-- Add comment explaining the columns
COMMENT ON COLUMN public.lg_patients.previous_names IS 'Array of previous names: [{name, type (maiden/married/previous), evidence}]';
COMMENT ON COLUMN public.lg_patients.identity_verification_status IS 'Status: pending, verified, warning, conflict';
COMMENT ON COLUMN public.lg_patients.identity_verification_issues IS 'Array of identity issues found during extraction';
COMMENT ON COLUMN public.lg_patients.nhs_number_validated IS 'Whether NHS number passes Mod 11 checksum';