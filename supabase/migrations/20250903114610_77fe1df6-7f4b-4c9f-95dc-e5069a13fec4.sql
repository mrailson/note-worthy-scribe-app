-- Fix the complete_meeting function to handle unique constraint properly
CREATE OR REPLACE FUNCTION public.complete_meeting(meeting_id uuid)
RETURNS json AS $$
DECLARE
    result_row meetings%rowtype;
    user_id_val uuid;
BEGIN
    -- Get current user ID
    user_id_val := auth.uid();
    
    -- Check if user ID exists
    IF user_id_val IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated');
    END IF;
    
    -- Check if meeting exists and user has access
    SELECT * INTO result_row 
    FROM meetings 
    WHERE id = meeting_id AND user_id = user_id_val;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Meeting not found or access denied');
    END IF;
    
    -- Check if already completed
    IF result_row.status = 'completed' THEN
        RETURN json_build_object('success', false, 'error', 'Meeting is already completed');
    END IF;
    
    -- Update meeting status
    UPDATE meetings 
    SET status = 'completed',
        updated_at = now(),
        notes_generation_status = 'queued'
    WHERE id = meeting_id AND user_id = user_id_val;
    
    -- Queue standard note generation with proper conflict handling
    INSERT INTO public.meeting_notes_queue (meeting_id, status, note_type, detail_level)
    VALUES (meeting_id, 'pending', 'standard', 'standard')
    ON CONFLICT (meeting_id, note_type) 
    DO UPDATE SET 
        status = 'pending',
        detail_level = 'standard',
        updated_at = now(),
        retry_count = 0,
        error_message = NULL,
        started_at = NULL,
        completed_at = NULL;
    
    -- Return success with updated meeting info
    SELECT * INTO result_row 
    FROM meetings 
    WHERE id = meeting_id;
    
    RETURN json_build_object(
        'success', true, 
        'meeting', row_to_json(result_row)
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Log the exact error for debugging
        RAISE LOG 'complete_meeting error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
        
        RETURN json_build_object(
            'success', false, 
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;