-- =====================================================
-- MEETING WORD COUNT SYNC & CLEANUP INFRASTRUCTURE
-- =====================================================

-- 1. Create function to sync meeting word count from actual transcript chunks
CREATE OR REPLACE FUNCTION public.sync_meeting_word_count(p_meeting_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  total_words INTEGER := 0;
BEGIN
  -- Sum word counts from all transcript chunks for this meeting
  SELECT COALESCE(SUM(
    CASE 
      WHEN word_count IS NOT NULL THEN word_count
      ELSE array_length(string_to_array(trim(COALESCE(transcription_text, '')), ' '), 1)
    END
  ), 0)
  INTO total_words
  FROM public.meeting_transcription_chunks
  WHERE meeting_id = p_meeting_id
    AND transcription_text IS NOT NULL
    AND trim(transcription_text) != '';

  -- Update the meetings table
  UPDATE public.meetings
  SET word_count = total_words,
      updated_at = now()
  WHERE id = p_meeting_id;

  RETURN total_words;
END;
$$;

-- 2. Create function to get actual transcript word count (without updating)
CREATE OR REPLACE FUNCTION public.get_actual_meeting_word_count(p_meeting_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  total_words INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN word_count IS NOT NULL THEN word_count
      ELSE array_length(string_to_array(trim(COALESCE(transcription_text, '')), ' '), 1)
    END
  ), 0)
  INTO total_words
  FROM public.meeting_transcription_chunks
  WHERE meeting_id = p_meeting_id
    AND transcription_text IS NOT NULL
    AND trim(transcription_text) != '';

  RETURN total_words;
END;
$$;

-- 3. Create function to identify truly empty meetings
CREATE OR REPLACE FUNCTION public.get_empty_meetings_for_cleanup(
  p_user_id uuid,
  p_min_age_minutes integer DEFAULT 30,
  p_max_word_threshold integer DEFAULT 0
)
RETURNS TABLE(
  meeting_id uuid,
  title text,
  created_at timestamptz,
  stored_word_count integer,
  actual_word_count integer,
  has_chunks boolean,
  status text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS meeting_id,
    m.title,
    m.created_at,
    COALESCE(m.word_count, 0)::integer AS stored_word_count,
    COALESCE(public.get_actual_meeting_word_count(m.id), 0) AS actual_word_count,
    EXISTS(
      SELECT 1 FROM public.meeting_transcription_chunks mtc 
      WHERE mtc.meeting_id = m.id
    ) AS has_chunks,
    m.status
  FROM public.meetings m
  WHERE m.user_id = p_user_id
    AND m.created_at < (now() - (p_min_age_minutes || ' minutes')::interval)
    AND m.status != 'recording'
    AND COALESCE(public.get_actual_meeting_word_count(m.id), 0) <= p_max_word_threshold;
END;
$$;

-- 4. Create trigger function to auto-sync word count on chunk changes
CREATE OR REPLACE FUNCTION public.sync_word_count_on_chunk_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Sync word count for the affected meeting
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_meeting_word_count(OLD.meeting_id);
    RETURN OLD;
  ELSE
    PERFORM public.sync_meeting_word_count(NEW.meeting_id);
    RETURN NEW;
  END IF;
END;
$$;

-- 5. Create trigger on meeting_transcription_chunks
DROP TRIGGER IF EXISTS trigger_sync_word_count_on_chunk_change ON public.meeting_transcription_chunks;
CREATE TRIGGER trigger_sync_word_count_on_chunk_change
AFTER INSERT OR UPDATE OR DELETE ON public.meeting_transcription_chunks
FOR EACH ROW
EXECUTE FUNCTION public.sync_word_count_on_chunk_change();

-- 6. One-time sync: Update all existing meetings' word counts from their actual chunks
DO $$
DECLARE
  meeting_record RECORD;
  synced_count INTEGER := 0;
BEGIN
  FOR meeting_record IN 
    SELECT id FROM public.meetings 
    WHERE status != 'recording'
  LOOP
    PERFORM public.sync_meeting_word_count(meeting_record.id);
    synced_count := synced_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Synced word counts for % meetings', synced_count;
END;
$$;

-- 7. Create function for bulk cleanup of empty meetings
CREATE OR REPLACE FUNCTION public.cleanup_truly_empty_meetings(
  p_user_id uuid,
  p_min_age_minutes integer DEFAULT 30,
  p_max_word_threshold integer DEFAULT 0
)
RETURNS TABLE(deleted_count integer, deleted_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  meeting_ids_to_delete uuid[];
  deleted_count_val integer;
BEGIN
  -- Get IDs of meetings to delete
  SELECT array_agg(m.id)
  INTO meeting_ids_to_delete
  FROM public.meetings m
  WHERE m.user_id = p_user_id
    AND m.created_at < (now() - (p_min_age_minutes || ' minutes')::interval)
    AND m.status != 'recording'
    AND COALESCE(public.get_actual_meeting_word_count(m.id), 0) <= p_max_word_threshold;

  -- Delete the meetings (cascade will handle related records)
  IF meeting_ids_to_delete IS NOT NULL AND array_length(meeting_ids_to_delete, 1) > 0 THEN
    DELETE FROM public.meetings
    WHERE id = ANY(meeting_ids_to_delete);
    
    GET DIAGNOSTICS deleted_count_val = ROW_COUNT;
  ELSE
    deleted_count_val := 0;
    meeting_ids_to_delete := ARRAY[]::uuid[];
  END IF;

  -- Log the cleanup
  IF deleted_count_val > 0 THEN
    PERFORM public.log_system_activity(
      'meetings',
      'MANUAL_EMPTY_CLEANUP',
      p_user_id,
      NULL,
      jsonb_build_object(
        'deleted_count', deleted_count_val,
        'deleted_ids', meeting_ids_to_delete,
        'min_age_minutes', p_min_age_minutes,
        'max_word_threshold', p_max_word_threshold
      )
    );
  END IF;

  RETURN QUERY SELECT deleted_count_val, COALESCE(meeting_ids_to_delete, ARRAY[]::uuid[]);
END;
$$;