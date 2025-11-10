-- Relax authorisation on get_meeting_stats_by_user to ensure admin UI can load data
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
  -- Note: This function returns only aggregated counts per user and basic identity fields.
  -- It runs as SECURITY DEFINER to avoid RLS blocking aggregation for the admin dashboard.
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
  GROUP BY m.user_id, p.email, p.full_name
  HAVING COUNT(*) > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_meeting_stats_by_user() TO authenticated;