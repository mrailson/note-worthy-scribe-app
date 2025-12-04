-- Add pdf_part_urls column to store URLs for split PDF parts
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS pdf_part_urls jsonb DEFAULT '[]'::jsonb;