-- Phase 2: Add database-level safeguards to prevent meeting notes crossover

-- Add unique constraint to meeting_summaries to prevent duplicate entries
ALTER TABLE public.meeting_summaries 
ADD CONSTRAINT meeting_summaries_meeting_id_unique UNIQUE (meeting_id);

-- Add explicit foreign key constraint with CASCADE for data integrity
ALTER TABLE public.meeting_summaries
DROP CONSTRAINT IF EXISTS meeting_summaries_meeting_id_fkey,
ADD CONSTRAINT meeting_summaries_meeting_id_fkey 
  FOREIGN KEY (meeting_id) 
  REFERENCES public.meetings(id) 
  ON DELETE CASCADE;

-- Create function to validate meeting ownership before displaying notes
CREATE OR REPLACE FUNCTION public.validate_meeting_access(p_meeting_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Check if meeting exists and user has access
  RETURN EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = p_meeting_id 
    AND (
      m.user_id = p_user_id OR
      EXISTS (
        SELECT 1 FROM public.meeting_shares ms
        WHERE ms.meeting_id = p_meeting_id 
        AND ms.shared_with_user_id = p_user_id
      )
    )
  );
END;
$$;

-- Add audit logging for meeting summary operations to track any crossover issues
CREATE OR REPLACE FUNCTION public.audit_meeting_summary_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Log all meeting summary operations for debugging crossover issues
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_system_activity(
      'meeting_summaries',
      'SUMMARY_CREATED',
      NEW.meeting_id,
      NULL,
      jsonb_build_object(
        'meeting_id', NEW.meeting_id,
        'summary_length', LENGTH(COALESCE(NEW.summary, '')),
        'operation', 'INSERT',
        'timestamp', now(),
        'user_id', auth.uid()
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_system_activity(
      'meeting_summaries',
      'SUMMARY_UPDATED', 
      NEW.meeting_id,
      jsonb_build_object('old_summary_length', LENGTH(COALESCE(OLD.summary, ''))),
      jsonb_build_object(
        'meeting_id', NEW.meeting_id,
        'new_summary_length', LENGTH(COALESCE(NEW.summary, '')),
        'operation', 'UPDATE',
        'timestamp', now(),
        'user_id', auth.uid()
      )
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger to audit meeting summary operations
DROP TRIGGER IF EXISTS audit_meeting_summary_operations_trigger ON public.meeting_summaries;
CREATE TRIGGER audit_meeting_summary_operations_trigger
  AFTER INSERT OR UPDATE ON public.meeting_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_meeting_summary_operations();

-- Add function to detect potential meeting data crossover
CREATE OR REPLACE FUNCTION public.detect_meeting_data_crossover()
RETURNS TABLE(
  meeting_id uuid,
  meeting_title text,
  summary_meeting_id uuid,
  potential_crossover boolean,
  last_updated timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as meeting_id,
    m.title as meeting_title,
    ms.meeting_id as summary_meeting_id,
    (m.id != ms.meeting_id) as potential_crossover,
    ms.updated_at as last_updated
  FROM public.meetings m
  LEFT JOIN public.meeting_summaries ms ON m.id = ms.meeting_id
  WHERE ms.meeting_id IS NOT NULL
  AND m.created_at >= NOW() - INTERVAL '30 days'  -- Recent meetings only
  ORDER BY ms.updated_at DESC;
END;
$$;