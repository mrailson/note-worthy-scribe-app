-- Add script_style column to audio_overview_sessions table
ALTER TABLE audio_overview_sessions 
ADD COLUMN script_style TEXT DEFAULT 'executive';

-- Add index for filtering by script style
CREATE INDEX idx_audio_overview_sessions_script_style ON audio_overview_sessions(script_style);