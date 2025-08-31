-- Fix auto notes generation by creating trigger and updating existing meetings
-- First, let's fix the meetings that should be completed
UPDATE meetings 
SET status = 'completed', notes_generation_status = 'pending'
WHERE status = 'recording' 
  AND created_at < NOW() - INTERVAL '10 minutes'
  AND notes_generation_status = 'not_started';

-- Create improved trigger function for auto meeting notes
CREATE OR REPLACE FUNCTION public.trigger_auto_meeting_notes()
RETURNS TRIGGER AS $$
DECLARE
    transcript_count INTEGER;
    min_word_threshold INTEGER := 50;
BEGIN
    -- Only trigger if status changed to 'completed'
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
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
            -- Update notes generation status to pending
            UPDATE public.meetings 
            SET notes_generation_status = 'pending' 
            WHERE id = NEW.id;
            
            -- Insert into queue for processing
            INSERT INTO public.meeting_notes_queue (meeting_id, status, detail_level, priority)
            VALUES (NEW.id, 'pending', 'standard', 1)
            ON CONFLICT (meeting_id) DO NOTHING;
            
            -- Notify background processor
            PERFORM pg_notify('auto_generate_notes', NEW.id::text);
            
            -- Log the trigger
            RAISE NOTICE 'Auto notes generation triggered for meeting: %', NEW.id;
        ELSE
            RAISE NOTICE 'No transcript found for meeting %, skipping auto notes', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;