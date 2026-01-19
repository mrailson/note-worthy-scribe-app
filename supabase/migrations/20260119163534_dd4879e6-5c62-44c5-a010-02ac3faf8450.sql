-- Add CGA notes column to store the 17-section Comprehensive Geriatric Assessment
ALTER TABLE public.gp_consultation_notes
ADD COLUMN IF NOT EXISTS cga_notes jsonb;