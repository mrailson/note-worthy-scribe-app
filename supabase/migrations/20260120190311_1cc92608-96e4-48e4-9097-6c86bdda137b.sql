-- Add is_systmone_optimised column to track SystmOne optimization status
ALTER TABLE public.gp_consultation_notes 
ADD COLUMN IF NOT EXISTS is_systmone_optimised BOOLEAN DEFAULT false;

-- Add an index for querying optimized consultations
CREATE INDEX IF NOT EXISTS idx_gp_consultation_notes_systmone_optimised 
ON public.gp_consultation_notes(is_systmone_optimised) 
WHERE is_systmone_optimised = true;