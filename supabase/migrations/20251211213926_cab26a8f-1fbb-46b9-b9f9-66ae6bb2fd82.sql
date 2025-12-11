-- Add column to track OCR analysis percentage for large documents
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS ocr_analysed_percentage INTEGER DEFAULT 100;

-- Add column to track total OCR text length
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS ocr_total_chars INTEGER DEFAULT NULL;

-- Add column to track how many chars were actually analysed
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS ocr_analysed_chars INTEGER DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.lg_patients.ocr_analysed_percentage IS 'Percentage of OCR text that was sent to AI for analysis (100% if under limit, less for very large documents)';
COMMENT ON COLUMN public.lg_patients.ocr_total_chars IS 'Total character count of merged OCR text';
COMMENT ON COLUMN public.lg_patients.ocr_analysed_chars IS 'Number of characters actually sent to AI for analysis';