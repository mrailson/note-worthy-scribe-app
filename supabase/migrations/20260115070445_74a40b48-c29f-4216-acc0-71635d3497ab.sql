-- Drop existing function first, then recreate with new return type
DROP FUNCTION IF EXISTS public.get_all_live_recordings();

-- Enhanced get_all_live_recordings function with word count statistics
CREATE OR REPLACE FUNCTION public.get_all_live_recordings()
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  duration_minutes integer,
  user_id uuid,
  total_word_count integer,
  words_last_5_mins integer,
  last_chunk_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow system admins
  IF NOT is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: System admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    m.id,
    m.title,
    m.status,
    m.created_at,
    m.updated_at,
    m.duration_minutes,
    m.user_id,
    -- Total word count from chunks
    COALESCE((
      SELECT SUM(COALESCE(c.word_count, 
        array_length(string_to_array(trim(COALESCE(c.transcription_text, '')), ' '), 1)
      ))::integer
      FROM meeting_transcription_chunks c
      WHERE c.meeting_id = m.id
    ), 0) as total_word_count,
    -- Words in last 5 minutes
    COALESCE((
      SELECT SUM(COALESCE(c.word_count, 
        array_length(string_to_array(trim(COALESCE(c.transcription_text, '')), ' '), 1)
      ))::integer
      FROM meeting_transcription_chunks c
      WHERE c.meeting_id = m.id
        AND c.created_at >= (now() - interval '5 minutes')
    ), 0) as words_last_5_mins,
    -- Last chunk timestamp
    (SELECT MAX(c.created_at) FROM meeting_transcription_chunks c WHERE c.meeting_id = m.id) as last_chunk_at
  FROM meetings m
  WHERE m.status = 'recording'
  ORDER BY m.created_at DESC;
END;
$$;