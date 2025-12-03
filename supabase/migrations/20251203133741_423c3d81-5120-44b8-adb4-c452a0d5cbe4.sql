-- Create table to store OCR batch results (instead of storage files)
CREATE TABLE lg_ocr_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT NOT NULL,
  batch_number INTEGER NOT NULL,
  ocr_text TEXT NOT NULL,
  pages_processed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, batch_number)
);

-- Enable RLS
ALTER TABLE lg_ocr_batches ENABLE ROW LEVEL SECURITY;

-- Service role has full access (edge functions use service role)
CREATE POLICY "Service role full access" ON lg_ocr_batches
  FOR ALL USING (true);

-- Index for fast lookup
CREATE INDEX idx_lg_ocr_batches_patient ON lg_ocr_batches(patient_id, batch_number);