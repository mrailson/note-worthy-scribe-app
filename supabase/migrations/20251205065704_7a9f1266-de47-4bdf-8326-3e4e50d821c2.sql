-- Add publishing workflow columns to lg_patients
ALTER TABLE lg_patients ADD COLUMN IF NOT EXISTS publish_status text DEFAULT 'pending';
ALTER TABLE lg_patients ADD COLUMN IF NOT EXISTS downloaded_at timestamptz;
ALTER TABLE lg_patients ADD COLUMN IF NOT EXISTS uploaded_to_s1_at timestamptz;
ALTER TABLE lg_patients ADD COLUMN IF NOT EXISTS validation_screenshot_url text;
ALTER TABLE lg_patients ADD COLUMN IF NOT EXISTS validation_result jsonb;
ALTER TABLE lg_patients ADD COLUMN IF NOT EXISTS validated_at timestamptz;
ALTER TABLE lg_patients ADD COLUMN IF NOT EXISTS validated_by text;
ALTER TABLE lg_patients ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Add index for filtering by publish_status
CREATE INDEX IF NOT EXISTS idx_lg_patients_publish_status ON lg_patients(publish_status);
CREATE INDEX IF NOT EXISTS idx_lg_patients_archived_at ON lg_patients(archived_at);