-- Add data retention policy for meeting transcription chunks
INSERT INTO public.data_retention_policies (
  table_name,
  retention_period_days,
  description,
  legal_basis
) VALUES (
  'meeting_transcription_chunks',
  30,
  'Transcription chunks are kept for 30 days after meeting completion for debugging and reprocessing purposes',
  'Operational necessity for service quality and debugging'
)
ON CONFLICT (table_name) 
DO UPDATE SET 
  retention_period_days = 30,
  description = 'Transcription chunks are kept for 30 days after meeting completion for debugging and reprocessing purposes',
  legal_basis = 'Operational necessity for service quality and debugging',
  updated_at = now();

-- Create function to cleanup old transcription chunks
CREATE OR REPLACE FUNCTION public.cleanup_old_transcription_chunks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete chunks from completed meetings older than 30 days
  DELETE FROM public.meeting_transcription_chunks mtc
  WHERE mtc.created_at < NOW() - INTERVAL '30 days'
    AND EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = mtc.meeting_id
        AND m.status = 'completed'
        AND m.end_time < NOW() - INTERVAL '30 days'
    );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup operation
  IF deleted_count > 0 THEN
    PERFORM public.log_system_activity(
      'meeting_transcription_chunks',
      'AUTO_CLEANUP_OLD_CHUNKS',
      NULL,
      NULL,
      jsonb_build_object(
        'deleted_count', deleted_count,
        'cleanup_time', now(),
        'retention_days', 30
      )
    );
  END IF;
  
  RETURN deleted_count;
END;
$$;