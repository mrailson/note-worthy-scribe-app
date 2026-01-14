-- Add patient context columns to gp_consultations table
ALTER TABLE gp_consultations
ADD COLUMN IF NOT EXISTS patient_name TEXT,
ADD COLUMN IF NOT EXISTS patient_nhs_number TEXT,
ADD COLUMN IF NOT EXISTS patient_dob TEXT,
ADD COLUMN IF NOT EXISTS patient_context_confidence REAL;

-- Create index for faster lookups by NHS number
CREATE INDEX IF NOT EXISTS idx_consultations_patient_nhs ON gp_consultations(patient_nhs_number);

-- Add comment for documentation
COMMENT ON COLUMN gp_consultations.patient_name IS 'Patient name captured from EMR context';
COMMENT ON COLUMN gp_consultations.patient_nhs_number IS 'NHS number captured from EMR context';
COMMENT ON COLUMN gp_consultations.patient_dob IS 'Patient date of birth captured from EMR context';
COMMENT ON COLUMN gp_consultations.patient_context_confidence IS 'AI confidence score for patient context extraction (0-1)';