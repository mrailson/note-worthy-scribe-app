-- First, clean up any invalid values in the column
UPDATE meetings 
SET primary_transcript_source = NULL 
WHERE primary_transcript_source NOT IN ('whisper', 'assembly', 'consolidated');

-- Now update the check constraint to allow 'consolidated' value
ALTER TABLE meetings 
  DROP CONSTRAINT IF EXISTS meetings_primary_transcript_source_check;

ALTER TABLE meetings 
  ADD CONSTRAINT meetings_primary_transcript_source_check 
  CHECK (primary_transcript_source IS NULL OR primary_transcript_source IN ('whisper', 'assembly', 'consolidated'));