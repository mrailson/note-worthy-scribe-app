-- Create function for system admins to get all live recordings
CREATE OR REPLACE FUNCTION public.get_all_live_recordings()
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  duration_minutes integer,
  user_id uuid
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
    m.user_id
  FROM meetings m
  WHERE m.status = 'recording'
  ORDER BY m.created_at DESC;
END;
$$;

-- Create function for system admins to get recently completed meetings
CREATE OR REPLACE FUNCTION public.get_recent_completed_meetings(since_time timestamptz)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  duration_minutes integer,
  user_id uuid
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
    m.user_id
  FROM meetings m
  WHERE m.status = 'completed'
    AND m.updated_at >= since_time
  ORDER BY m.updated_at DESC
  LIMIT 20;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_all_live_recordings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_completed_meetings(timestamptz) TO authenticated;