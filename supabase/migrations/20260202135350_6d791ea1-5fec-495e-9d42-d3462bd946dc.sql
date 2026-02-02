CREATE OR REPLACE FUNCTION public.cleanup_stuck_meetings()
RETURNS TABLE(fixed_meetings_count integer, fixed_meeting_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  fixed_count integer := 0;
  meeting_ids uuid[];
BEGIN
  -- Find and fix meetings stuck in recording status
  -- IMPORTANT: Only close meetings that are:
  -- 1. Older than 90 minutes (matching the edge function threshold), OR
  -- 2. Already have notes generated (definitely stuck)
  -- 
  -- Do NOT close meetings just because they have word_count > 0
  -- as this would close actively recording meetings prematurely.
  UPDATE meetings 
  SET 
    status = 'completed',
    end_time = COALESCE(end_time, updated_at, created_at + INTERVAL '2 hours'),
    updated_at = now()
  WHERE status = 'recording' 
    AND (
      notes_generation_status = 'completed'  -- Already has notes = definitely stuck
      OR created_at < now() - INTERVAL '90 minutes'  -- Match edge function threshold
    )
  RETURNING id INTO meeting_ids;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  -- Log the cleanup operation
  IF fixed_count > 0 THEN
    PERFORM log_system_activity(
      'meetings',
      'AUTO_CLEANUP_STUCK_RECORDINGS',
      NULL,
      jsonb_build_object(
        'fixed_count', fixed_count,
        'meeting_ids', meeting_ids,
        'cleanup_time', now(),
        'threshold_minutes', 90
      ),
      NULL
    );
  END IF;
  
  RETURN QUERY SELECT fixed_count, meeting_ids;
END;
$$;