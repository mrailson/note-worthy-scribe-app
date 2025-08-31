-- Simple fix: just update stuck meetings and create the trigger
UPDATE meetings 
SET status = 'completed'
WHERE status = 'recording' 
  AND created_at < NOW() - INTERVAL '10 minutes';

-- Create the trigger on meetings table  
DROP TRIGGER IF EXISTS trigger_auto_meeting_notes_on_meetings ON meetings;
CREATE TRIGGER trigger_auto_meeting_notes_on_meetings
    AFTER UPDATE ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_meeting_notes();