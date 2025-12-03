-- Add columns for multi-phase processing support (100+ pages)
ALTER TABLE public.lg_patients
ADD COLUMN IF NOT EXISTS processing_phase text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS ocr_batches_total integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ocr_batches_completed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ocr_text_url text,
ADD COLUMN IF NOT EXISTS pdf_generation_status text DEFAULT 'pending';

-- Add comment
COMMENT ON COLUMN public.lg_patients.processing_phase IS 'Current processing phase: pending, ocr, summary, pdf, complete';
COMMENT ON COLUMN public.lg_patients.ocr_batches_total IS 'Total OCR batches for large records';
COMMENT ON COLUMN public.lg_patients.ocr_batches_completed IS 'Number of OCR batches completed';
COMMENT ON COLUMN public.lg_patients.ocr_text_url IS 'Storage URL for merged OCR text file';
COMMENT ON COLUMN public.lg_patients.pdf_generation_status IS 'PDF generation status: pending, queued, generating, complete, skipped';