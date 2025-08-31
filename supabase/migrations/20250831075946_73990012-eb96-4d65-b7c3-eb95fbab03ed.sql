-- Fix Phase 1: Recreate the missing database trigger for auto notes generation
-- First ensure the trigger function exists and is correct
CREATE OR REPLACE FUNCTION public.trigger_auto_meeting_notes()
RETURNS TRIGGER AS $$
DECLARE
    transcript_count INTEGER;
    min_word_threshold INTEGER := 50;
BEGIN
    -- Only proceed if status changed TO 'completed' and we have transcript content
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Check if meeting has sufficient transcript content
        SELECT COUNT(*) INTO transcript_count
        FROM public.meeting_transcripts mt
        WHERE mt.meeting_id = NEW.id;
        
        -- Also check meeting_transcription_chunks for content
        IF transcript_count = 0 THEN
            SELECT COUNT(*) INTO transcript_count
            FROM public.meeting_transcription_chunks mtc
            WHERE mtc.meeting_id = NEW.id;
        END IF;
        
        -- Only trigger if we have transcript content
        IF transcript_count > 0 THEN
            -- Set notes generation status to pending
            UPDATE public.meetings 
            SET notes_generation_status = 'pending'
            WHERE id = NEW.id;
            
            -- Insert into queue (with conflict handling)
            INSERT INTO public.meeting_notes_queue (meeting_id, status, detail_level)
            VALUES (NEW.id, 'pending', 'standard')
            ON CONFLICT (meeting_id) 
            DO UPDATE SET 
                status = 'pending',
                detail_level = 'standard',
                updated_at = now();
            
            -- Notify background processing
            PERFORM pg_notify('auto_generate_notes', NEW.id::text);
            
            RAISE LOG 'Auto notes generation triggered for meeting: %', NEW.id;
        ELSE
            RAISE LOG 'No transcript content found for meeting: %, skipping notes generation', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger to ensure it's working
DROP TRIGGER IF EXISTS trigger_auto_meeting_notes_on_meetings ON public.meetings;
CREATE TRIGGER trigger_auto_meeting_notes_on_meetings
    AFTER UPDATE ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_meeting_notes();

-- Fix Phase 3: Manually recover the stuck 08:45 meeting
-- Update the stuck meeting to completed status (this should trigger the auto notes)
UPDATE public.meetings 
SET status = 'completed'
WHERE id = 'cc8fd683-0bfb-409b-987f-025562383537'
AND status = 'recording';