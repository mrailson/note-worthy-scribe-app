-- Add clinical system and branch site columns to practice_details
ALTER TABLE public.practice_details 
ADD COLUMN IF NOT EXISTS clinical_system TEXT,
ADD COLUMN IF NOT EXISTS has_branch_site BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS branch_site_name TEXT,
ADD COLUMN IF NOT EXISTS branch_site_address TEXT,
ADD COLUMN IF NOT EXISTS branch_site_postcode TEXT,
ADD COLUMN IF NOT EXISTS branch_site_phone TEXT;

COMMENT ON COLUMN public.practice_details.clinical_system IS 'Clinical system used (e.g., EMIS, SystmOne, Vision)';
COMMENT ON COLUMN public.practice_details.has_branch_site IS 'Whether the practice has a branch site';
COMMENT ON COLUMN public.practice_details.branch_site_name IS 'Branch site name';
COMMENT ON COLUMN public.practice_details.branch_site_address IS 'Branch site address';
COMMENT ON COLUMN public.practice_details.branch_site_postcode IS 'Branch site postcode';
COMMENT ON COLUMN public.practice_details.branch_site_phone IS 'Branch site phone number';