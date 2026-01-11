-- Add complaint_source column to track where complaints originate from
-- This enables different acknowledgement workflows for NHS Resolution, ICB, etc.

ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS complaint_source text DEFAULT 'patient';

-- Add comment explaining the column
COMMENT ON COLUMN public.complaints.complaint_source IS 'Source of the complaint: patient (default), nhs_resolution, icb, cqc, ombudsman, mp, solicitor, other';

-- Create an index for filtering by source
CREATE INDEX IF NOT EXISTS idx_complaints_source ON public.complaints(complaint_source);