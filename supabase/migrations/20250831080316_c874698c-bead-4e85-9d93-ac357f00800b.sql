-- Fix Phase 1: Add unique constraint and fix the trigger
-- Add unique constraint to meeting_notes_queue to support ON CONFLICT
ALTER TABLE public.meeting_notes_queue ADD CONSTRAINT meeting_notes_queue_meeting_id_unique UNIQUE (meeting_id);

-- Simplified trigger function without ON CONFLICT
CREATE OR REPLACE FUNCTION public.trigger_auto_meeting_notes()
RETURNS TRIGGER AS $$
DECLARE
    transcript_count INTEGER := 0;
    existing_queue_record INTEGER := 0;
BEGIN
    -- Only proceed if status changed TO 'completed' 
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
            -- Update meeting notes generation status to queued
            UPDATE public.meetings 
            SET notes_generation_status = 'queued'
            WHERE id = NEW.id;
            
            -- Check if already in queue
            SELECT COUNT(*) INTO existing_queue_record
            FROM public.meeting_notes_queue 
            WHERE meeting_id = NEW.id;
            
            -- Insert into queue if not already there
            IF existing_queue_record = 0 THEN
                INSERT INTO public.meeting_notes_queue (meeting_id, status, detail_level)
                VALUES (NEW.id, 'pending', 'standard');
            ELSE
                -- Update existing record
                UPDATE public.meeting_notes_queue
                SET status = 'pending', detail_level = 'standard', updated_at = now()
                WHERE meeting_id = NEW.id;
            END IF;
            
            -- Notify background processing
            PERFORM pg_notify('auto_generate_notes', NEW.id::text);
            
            RAISE LOG 'Auto notes generation triggered for meeting: %', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_meeting_notes_on_meetings ON public.meetings;
CREATE TRIGGER trigger_auto_meeting_notes_on_meetings
    AFTER UPDATE ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_meeting_notes();

-- Fix Phase 2: Update the stuck meeting to trigger auto notes
UPDATE public.meetings 
SET status = 'completed'
WHERE id = 'cc8fd683-0bfb-409b-987f-025562383537';