-- Fix the stuck meeting notes queue and missing column issues

-- First, add the missing is_paused column that's breaking the auto-close function
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false;

-- Clean up stuck queue entries by setting them to failed status
-- These have been pending for days without processing
UPDATE public.meeting_notes_queue 
SET 
  status = 'failed',
  error_message = 'Queue entry stuck - cleaned up during maintenance',
  updated_at = now()
WHERE status = 'pending' 
  AND created_at < now() - INTERVAL '24 hours'
  AND started_at IS NULL;

-- Reset the meeting that's stuck in queued status
UPDATE public.meetings 
SET notes_generation_status = 'failed'
WHERE notes_generation_status = 'queued' 
  AND updated_at < now() - INTERVAL '24 hours';

-- Create a function to manually trigger queue processing (for testing)
CREATE OR REPLACE FUNCTION public.trigger_queue_processing()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_count INTEGER;
  result_json json;
BEGIN
  -- Count pending entries
  SELECT COUNT(*) INTO pending_count
  FROM meeting_notes_queue
  WHERE status = 'pending';
  
  -- Log the trigger attempt
  INSERT INTO system_audit_log (
    table_name,
    operation,
    user_id,
    new_values
  ) VALUES (
    'meeting_notes_queue',
    'MANUAL_TRIGGER',
    auth.uid(),
    jsonb_build_object(
      'pending_count', pending_count,
      'triggered_at', now()
    )
  );
  
  result_json := json_build_object(
    'success', true,
    'pending_entries', pending_count,
    'message', 'Queue processing trigger logged'
  );
  
  RETURN result_json;
END;
$$;