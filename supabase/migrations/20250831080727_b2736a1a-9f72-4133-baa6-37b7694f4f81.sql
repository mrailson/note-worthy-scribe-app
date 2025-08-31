-- Fix the trigger recursion bug - the condition was impossible
CREATE OR REPLACE FUNCTION public.trigger_auto_meeting_notes()
RETURNS TRIGGER AS $$
DECLARE
    transcript_count INTEGER := 0;
BEGIN
    -- Only proceed if status changed TO 'completed' 
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Check if meeting has transcript content
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
            -- Set notes generation status directly without recursion
            NEW.notes_generation_status = 'queued';
            
            -- Insert or update queue record
            INSERT INTO public.meeting_notes_queue (meeting_id, status, detail_level)
            VALUES (NEW.id, 'pending', 'standard')
            ON CONFLICT ON CONSTRAINT meeting_notes_queue_meeting_id_unique
            DO UPDATE SET 
                status = 'pending',
                detail_level = 'standard',
                updated_at = now();
            
            -- Notify background processing
            PERFORM pg_notify('auto_generate_notes', NEW.id::text);
            
            RAISE LOG 'Auto notes generation triggered for meeting: %', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;