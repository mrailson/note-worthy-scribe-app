-- Create a function to safely complete meetings
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
        updated_at = now()
    WHERE id = meeting_id AND user_id = user_id_val;
    
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