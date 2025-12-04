-- Add compression tracking columns to lg_patients
ALTER TABLE public.lg_patients ADD COLUMN IF NOT EXISTS pdf_final_size_mb DECIMAL(6,2);
ALTER TABLE public.lg_patients ADD COLUMN IF NOT EXISTS compression_tier TEXT;
ALTER TABLE public.lg_patients ADD COLUMN IF NOT EXISTS pdf_split BOOLEAN DEFAULT false;
ALTER TABLE public.lg_patients ADD COLUMN IF NOT EXISTS pdf_parts INTEGER DEFAULT 1;
ALTER TABLE public.lg_patients ADD COLUMN IF NOT EXISTS compression_attempts INTEGER DEFAULT 0;
ALTER TABLE public.lg_patients ADD COLUMN IF NOT EXISTS original_size_mb DECIMAL(6,2);

-- Add comment for documentation
COMMENT ON COLUMN public.lg_patients.compression_tier IS 'Tier 1 (≤10 pages, quality) or Tier 2 (>10 pages, aggressive)';
COMMENT ON COLUMN public.lg_patients.pdf_split IS 'Whether PDF was split into multiple parts for SystmOne 5MB limit';