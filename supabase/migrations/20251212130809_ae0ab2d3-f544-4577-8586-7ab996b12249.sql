-- Add columns to store all unique patient identifiers found during OCR analysis
-- This enables robust mixed-patient detection

ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS all_nhs_numbers_found text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS all_dobs_found text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS all_names_found text[] DEFAULT '{}';