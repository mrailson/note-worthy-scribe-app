-- Add timestamp columns to meeting_transcription_chunks for easier access and display
ALTER TABLE meeting_transcription_chunks 
ADD COLUMN IF NOT EXISTS start_time DECIMAL,
ADD COLUMN IF NOT EXISTS end_time DECIMAL,
ADD COLUMN IF NOT EXISTS segments_json JSONB;

-- Create index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_meeting_chunks_timestamps 
ON meeting_transcription_chunks(meeting_id, start_time, end_time);

-- Update existing rows to extract timestamps from JSON transcription_text
UPDATE meeting_transcription_chunks 
SET 
  segments_json = transcription_text::jsonb,
  start_time = (transcription_text::jsonb->0->>'start')::decimal,
  end_time = (transcription_text::jsonb->-1->>'end')::decimal
WHERE transcription_text LIKE '[{%'
  AND transcription_text::jsonb IS NOT NULL
  AND start_time IS NULL;