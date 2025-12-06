-- Add columns to lg_patients for tracking compressed PDF
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS compressed_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS compressed_pdf_size_mb NUMERIC,
ADD COLUMN IF NOT EXISTS compression_applied_at TIMESTAMP WITH TIME ZONE;