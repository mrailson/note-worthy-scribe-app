-- Add summary/SNOMED extraction timing columns
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS summary_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS summary_completed_at TIMESTAMP WITH TIME ZONE;