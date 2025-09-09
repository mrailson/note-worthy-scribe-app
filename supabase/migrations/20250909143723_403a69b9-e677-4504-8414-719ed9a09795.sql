-- Update the trigger to use the new simplified notification system
-- This replaces the complex trigger logic with a simple notification approach

-- Drop the old trigger first
DROP TRIGGER IF EXISTS trigger_auto_meeting_notes_on_meetings ON public.meetings;

-- Create a simple trigger that just sends notifications for completed meetings
CREATE TRIGGER trigger_meeting_completion_notification
    AFTER UPDATE ON public.meetings
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
    EXECUTE FUNCTION trigger_delayed_notes_generation();

COMMENT ON TRIGGER trigger_meeting_completion_notification ON public.meetings IS 'Simple notification trigger for meeting completion to avoid race conditions';