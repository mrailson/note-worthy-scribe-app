-- Add source_filename column to store the original PDF filename for backup reference
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS source_filename TEXT;