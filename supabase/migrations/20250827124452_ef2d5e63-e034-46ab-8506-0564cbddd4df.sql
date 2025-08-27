-- Add import source and configuration metadata to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS import_source TEXT,
ADD COLUMN IF NOT EXISTS import_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS meeting_configuration JSONB DEFAULT '{}';

-- Add index for import source queries
CREATE INDEX IF NOT EXISTS idx_meetings_import_source ON meetings(import_source);

-- Update existing meetings to have default configuration
UPDATE meetings 
SET meeting_configuration = COALESCE(meeting_configuration, '{}')
WHERE meeting_configuration IS NULL;