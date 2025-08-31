-- Fix auto notes generation with correct status values
-- First update existing meetings with proper status
UPDATE meetings 
SET status = 'completed', notes_generation_status = 'not_started'
WHERE status = 'recording' 
  AND created_at < NOW() - INTERVAL '10 minutes'
  AND notes_generation_status = 'not_started';

-- Create the trigger on meetings table
DROP TRIGGER IF EXISTS trigger_auto_meeting_notes_on_meetings ON meetings;
CREATE TRIGGER trigger_auto_meeting_notes_on_meetings
    AFTER UPDATE ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_meeting_notes();

-- Also manually trigger notes generation for existing completed meetings that don't have notes
DO $$
DECLARE
    meeting_record RECORD;
BEGIN
    FOR meeting_record IN 
        SELECT id FROM meetings 
        WHERE status = 'completed' 
          AND notes_generation_status = 'not_started'
          AND NOT EXISTS (SELECT 1 FROM meeting_summaries WHERE meeting_id = meetings.id)
          AND (
            EXISTS (SELECT 1 FROM meeting_transcripts WHERE meeting_id = meetings.id) 
            OR EXISTS (SELECT 1 FROM meeting_transcription_chunks WHERE meeting_id = meetings.id)
          )
    LOOP
        -- Update status and queue for generation
        UPDATE meetings SET notes_generation_status = 'not_started' WHERE id = meeting_record.id;
        
        INSERT INTO meeting_notes_queue (meeting_id, status, detail_level, priority)
        VALUES (meeting_record.id, 'pending', 'standard', 1)
        ON CONFLICT (meeting_id) DO NOTHING;
        
        RAISE NOTICE 'Queued meeting % for notes generation', meeting_record.id;
    END LOOP;
END $$;