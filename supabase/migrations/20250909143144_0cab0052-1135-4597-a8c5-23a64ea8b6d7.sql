-- Clean up duplicate triggers and create a single optimized trigger for meeting notes generation
-- This fixes the race condition issues and duplicate note generation attempts

-- First, disable and remove all existing triggers
DROP TRIGGER IF EXISTS trigger_auto_meeting_notes_on_meetings ON public.meetings;

-- Remove the old trigger function if it exists
DROP FUNCTION IF EXISTS public.trigger_auto_meeting_notes();

-- Create an improved trigger function with better logic and safeguards
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
            
            -- Generate batch ID for all note types
            batch_uuid := gen_random_uuid();
            
            -- Queue standard notes generation (primary)
            INSERT INTO public.meeting_notes_queue (meeting_id, status, note_type, batch_id, detail_level)
            VALUES (NEW.id, 'pending', 'standard', batch_uuid, 'standard')
            ON CONFLICT (meeting_id, note_type) 
            DO UPDATE SET 
                status = 'pending',
                batch_id = batch_uuid,
                updated_at = now(),
                retry_count = 0,
                error_message = NULL;
            
            -- Use pg_notify to trigger the edge function with a delay to avoid race conditions
            PERFORM pg_notify('auto_generate_notes_delayed', json_build_object(
                'meeting_id', NEW.id,
                'batch_id', batch_uuid,
                'delay_seconds', 3
            )::text);
            
            RAISE LOG 'Triggered auto notes generation for meeting: % with batch: %', NEW.id, batch_uuid;
        ELSE
            RAISE LOG 'No transcript content found for meeting: %, skipping notes generation', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp';

-- Create the trigger (only one, optimized)
CREATE TRIGGER trigger_auto_meeting_notes_on_meetings
    BEFORE UPDATE ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_meeting_notes();

-- Add an index to improve performance of the trigger queries
CREATE INDEX IF NOT EXISTS idx_meeting_summaries_meeting_id ON public.meeting_summaries(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcription_chunks_meeting_content ON public.meeting_transcription_chunks(meeting_id) WHERE transcription_text IS NOT NULL;

COMMENT ON FUNCTION public.trigger_auto_meeting_notes() IS 'Optimized trigger function to auto-generate meeting notes when a meeting is completed. Includes safeguards against duplicates and race conditions.';