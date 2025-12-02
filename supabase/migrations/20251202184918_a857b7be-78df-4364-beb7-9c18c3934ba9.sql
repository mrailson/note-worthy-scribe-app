-- Make patient detail fields nullable for AI extraction flow
ALTER TABLE public.lg_patients 
  ALTER COLUMN patient_name DROP NOT NULL,
  ALTER COLUMN nhs_number DROP NOT NULL,
  ALTER COLUMN dob DROP NOT NULL;

-- Add default for sex
ALTER TABLE public.lg_patients 
  ALTER COLUMN sex SET DEFAULT 'unknown';

-- Add AI extraction fields
ALTER TABLE public.lg_patients 
  ADD COLUMN IF NOT EXISTS ai_extracted_name text,
  ADD COLUMN IF NOT EXISTS ai_extracted_nhs text,
  ADD COLUMN IF NOT EXISTS ai_extracted_dob text,
  ADD COLUMN IF NOT EXISTS ai_extracted_sex text,
  ADD COLUMN IF NOT EXISTS ai_extraction_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS requires_verification boolean DEFAULT false;