-- Create a cleanup function to automatically fix stuck recordings
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
  -- Find and fix meetings stuck in recording status but have content
  UPDATE meetings 
  SET 
    status = 'completed',
    end_time = COALESCE(end_time, updated_at, created_at + INTERVAL '2 hours'),
    updated_at = now()
  WHERE status = 'recording' 
    AND (
      word_count > 0 
      OR notes_generation_status = 'completed'
      OR created_at < now() - INTERVAL '4 hours' -- recordings older than 4 hours
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
        'cleanup_time', now()
      ),
      NULL
    );
  END IF;
  
  RETURN QUERY SELECT fixed_count, meeting_ids;
END;
$$;

-- Create a scheduled job to run cleanup every hour
SELECT cron.schedule(
  'cleanup-stuck-meetings',
  '0 * * * *', -- Every hour at minute 0
  'SELECT cleanup_stuck_meetings();'
);