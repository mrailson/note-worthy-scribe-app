-- Remove user_id from meeting_transcripts insert in BrowserRecorder
-- The table doesn't need user_id since access is controlled via meeting ownership

-- Check current meeting_transcripts structure
SELECT column_name, data_type, is_nullable FROM information_schema.columns 
WHERE table_name = 'meeting_transcripts' 
ORDER BY ordinal_position;