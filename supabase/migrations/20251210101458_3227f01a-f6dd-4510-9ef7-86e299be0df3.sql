-- Drop and recreate function with additional columns
DROP FUNCTION IF EXISTS public.get_recent_completed_meetings(timestamptz);

CREATE FUNCTION public.get_recent_completed_meetings(since_time timestamptz)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  duration_minutes integer,
  user_id uuid,
  word_count integer,
  notes_generation_status text
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
    m.word_count,
    m.notes_generation_status
  FROM meetings m
  WHERE m.status = 'completed'
    AND m.updated_at >= since_time
  ORDER BY m.updated_at DESC
  LIMIT 20;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_recent_completed_meetings(timestamptz) TO authenticated;