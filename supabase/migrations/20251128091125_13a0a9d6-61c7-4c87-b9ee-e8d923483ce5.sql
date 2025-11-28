-- Add custom_directions column to audio_overview_sessions table
ALTER TABLE audio_overview_sessions 
ADD COLUMN IF NOT EXISTS custom_directions TEXT;