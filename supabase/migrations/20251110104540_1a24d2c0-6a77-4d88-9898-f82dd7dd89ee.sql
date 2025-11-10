-- Create a function to return meeting stats by user for admins, bypassing RLS safely
CREATE OR REPLACE FUNCTION public.get_meeting_stats_by_user()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  meeting_count integer,
  completed_meetings integer,
  recording_meetings integer,
  first_meeting_date timestamptz,
  latest_meeting_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorisation: only allow system admins and practice/PCN managers
  IF NOT (is_system_admin(auth.uid())
          OR has_role(auth.uid(), 'practice_manager'::app_role)
          OR has_role(auth.uid(), 'pcn_manager'::app_role)) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    COALESCE(p.email, 'Unknown') AS email,
    p.full_name,
    COUNT(*) AS meeting_count,
    COUNT(*) FILTER (WHERE m.status = 'completed') AS completed_meetings,
    COUNT(*) FILTER (WHERE m.status = 'recording') AS recording_meetings,
    MIN(m.created_at) AS first_meeting_date,
    MAX(m.created_at) AS latest_meeting_date
  FROM public.meetings m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  GROUP BY m.user_id, p.email, p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_meeting_stats_by_user() TO authenticated;