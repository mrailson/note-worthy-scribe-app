-- Add column to track which pages have identity conflicts
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS conflict_pages jsonb DEFAULT '[]'::jsonb;

-- This will store an array of objects like:
-- [{"page": 11, "nhs": "1234567890", "dob": "01/01/1950", "name": "John Smith"}]
-- Pages where the identity differs from the primary patient

COMMENT ON COLUMN public.lg_patients.conflict_pages IS 'Array of page objects containing identity info for pages that differ from primary patient';