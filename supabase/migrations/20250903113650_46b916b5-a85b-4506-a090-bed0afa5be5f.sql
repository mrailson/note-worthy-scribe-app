-- Update the complete_meeting function with correct detail_level values
CREATE OR REPLACE FUNCTION public.complete_meeting(meeting_id uuid)
RETURNS json AS $$
DECLARE
    result_row meetings%rowtype;
    user_id_val uuid;
    batch_uuid uuid;
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
    
    -- Generate batch ID for note generation
    batch_uuid := gen_random_uuid();
    
    -- Queue note generation with correct detail_level values
    INSERT INTO public.meeting_notes_queue (meeting_id, status, note_type, batch_id, detail_level)
    VALUES 
        (meeting_id, 'pending', 'brief', batch_uuid, 'headlines'),
        (meeting_id, 'pending', 'executive', batch_uuid, 'standard'),
        (meeting_id, 'pending', 'detailed', batch_uuid, 'more'),
        (meeting_id, 'pending', 'comprehensive', batch_uuid, 'super')
    ON CONFLICT (meeting_id, note_type) 
    DO UPDATE SET 
        status = 'pending',
        batch_id = batch_uuid,
        detail_level = EXCLUDED.detail_level,
        updated_at = now();
    
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
        RETURN json_build_object(
            'success', false, 
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;