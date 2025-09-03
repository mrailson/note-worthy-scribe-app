-- Update the trigger function to queue all 5 note types
CREATE OR REPLACE FUNCTION public.trigger_auto_meeting_notes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    transcript_count INTEGER := 0;
    batch_uuid UUID;
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
        
        -- Only trigger if we have transcript content and multi-type notes don't exist
        IF transcript_count > 0 AND NOT EXISTS (
            SELECT 1 FROM public.meeting_notes_multi 
            WHERE meeting_id = NEW.id 
            LIMIT 1
        ) THEN
            -- Set notes generation status directly without recursion
            NEW.notes_generation_status = 'queued';
            
            -- Generate batch ID for all 5 note types
            batch_uuid := gen_random_uuid();
            
            -- Queue all 5 note types
            INSERT INTO public.meeting_notes_queue (meeting_id, status, note_type, batch_id, detail_level)
            VALUES 
                (NEW.id, 'pending', 'brief', batch_uuid, 'brief'),
                (NEW.id, 'pending', 'executive', batch_uuid, 'executive'),
                (NEW.id, 'pending', 'detailed', batch_uuid, 'detailed'),
                (NEW.id, 'pending', 'very_detailed', batch_uuid, 'very_detailed'),
                (NEW.id, 'pending', 'limerick', batch_uuid, 'limerick')
            ON CONFLICT (meeting_id, note_type) 
            DO UPDATE SET 
                status = 'pending',
                batch_id = batch_uuid,
                updated_at = now();
            
            -- Notify background processing with batch ID
            PERFORM pg_notify('auto_generate_multi_notes', json_build_object(
                'meeting_id', NEW.id,
                'batch_id', batch_uuid
            )::text);
            
            RAISE LOG 'Auto multi-type notes generation triggered for meeting: % with batch: %', NEW.id, batch_uuid;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Update the unique constraint to allow multiple note types per meeting
ALTER TABLE meeting_notes_queue DROP CONSTRAINT IF EXISTS meeting_notes_queue_meeting_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS meeting_notes_queue_meeting_note_type_unique 
ON meeting_notes_queue(meeting_id, note_type);