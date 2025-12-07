-- Add batch_id column to lg_patients for tracking bulk/watch folder batches
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS batch_id UUID DEFAULT NULL;

-- Add index for efficient batch lookups
CREATE INDEX IF NOT EXISTS idx_lg_patients_batch_id ON public.lg_patients(batch_id);

-- Add batch report tracking fields
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS batch_report_sent BOOLEAN DEFAULT FALSE;