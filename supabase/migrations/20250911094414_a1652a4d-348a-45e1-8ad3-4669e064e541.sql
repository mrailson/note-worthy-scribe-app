-- Update trigger to auto-generate detailed minutes instead of standard
-- This changes the default auto-generated note type from 'standard' to 'detailed'

CREATE OR REPLACE FUNCTION public.trigger_auto_meeting_notes()
RETURNS TRIGGER AS $$
DECLARE
    transcript_count INTEGER := 0;
    batch_uuid UUID;
    existing_notes_count INTEGER := 0;
BEGIN
    -- Only proceed if status changed TO 'completed' from a different status
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Check if notes already exist to prevent duplicates
        SELECT COUNT(*) INTO existing_notes_count
        FROM public.meeting_summaries 
        WHERE meeting_id = NEW.id;
        
        -- Skip if notes already exist
        IF existing_notes_count > 0 THEN
            RAISE LOG 'Notes already exist for meeting %, skipping trigger', NEW.id;
            RETURN NEW;
        END IF;
        
        -- Check if meeting has transcript content from any source
        SELECT COUNT(*) INTO transcript_count
        FROM public.meeting_transcription_chunks mtc
        WHERE mtc.meeting_id = NEW.id 
        AND mtc.transcription_text IS NOT NULL 
        AND LENGTH(TRIM(mtc.transcription_text)) > 0;
        
        -- Also check legacy transcript tables if no chunks found
        IF transcript_count = 0 THEN
            SELECT COUNT(*) INTO transcript_count
            FROM public.meeting_transcripts mt
            WHERE mt.meeting_id = NEW.id 
            AND mt.content IS NOT NULL 
            AND LENGTH(TRIM(mt.content)) > 0;
        END IF;
        
        -- Also check legacy transcription_chunks table
        IF transcript_count = 0 THEN
            SELECT COUNT(*) INTO transcript_count
            FROM public.transcription_chunks tc
            WHERE tc.meeting_id = NEW.id 
            AND tc.transcript_text IS NOT NULL 
            AND LENGTH(TRIM(tc.transcript_text)) > 0;
        END IF;
        
        -- Only trigger if we have transcript content
        IF transcript_count > 0 THEN
            -- Set notes generation status
            NEW.notes_generation_status = 'queued';
            
            -- Generate batch ID for detailed notes
            batch_uuid := gen_random_uuid();
            
            -- Queue DETAILED notes generation (changed from 'standard' to 'detailed')
            INSERT INTO public.meeting_notes_queue (meeting_id, status, note_type, batch_id, detail_level)
            VALUES (NEW.id, 'pending', 'detailed', batch_uuid, 'detailed')
            ON CONFLICT (meeting_id, note_type) 
            DO UPDATE SET 
                status = 'pending',
                batch_id = batch_uuid,
                updated_at = now(),
                retry_count = 0,
                error_message = NULL;
            
            -- Use pg_notify to trigger detailed notes generation
            PERFORM pg_notify('auto_generate_detailed_notes', json_build_object(
                'meeting_id', NEW.id,
                'batch_id', batch_uuid,
                'note_type', 'detailed',
                'delay_seconds', 3
            )::text);
            
            RAISE LOG 'Triggered auto DETAILED notes generation for meeting: % with batch: %', NEW.id, batch_uuid;
        ELSE
            RAISE LOG 'No transcript content found for meeting: %, skipping notes generation', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp';

COMMENT ON FUNCTION public.trigger_auto_meeting_notes() IS 'Auto-generate DETAILED meeting notes (not standard) when a meeting is completed. This makes detailed notes the new default.';