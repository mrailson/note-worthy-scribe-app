-- Add script metadata columns to meeting_overviews table
ALTER TABLE meeting_overviews 
ADD COLUMN IF NOT EXISTS script_style TEXT,
ADD COLUMN IF NOT EXISTS pronunciation_rules JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS voice_id TEXT,
ADD COLUMN IF NOT EXISTS voice_name TEXT;

-- Add comments to document the new columns
COMMENT ON COLUMN meeting_overviews.script_style IS 'The style used to generate the audio script (executive, training, meeting, podcast, technical, patient)';
COMMENT ON COLUMN meeting_overviews.pronunciation_rules IS 'Array of pronunciation rules applied to the audio narration';
COMMENT ON COLUMN meeting_overviews.voice_id IS 'ElevenLabs voice ID used for audio generation';
COMMENT ON COLUMN meeting_overviews.voice_name IS 'Human-readable name of the voice used';