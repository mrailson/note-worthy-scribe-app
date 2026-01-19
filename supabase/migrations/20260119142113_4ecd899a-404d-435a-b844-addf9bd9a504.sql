-- Create get_gp_scribe_stats_by_user function to bypass RLS for admin stats
CREATE OR REPLACE FUNCTION public.get_gp_scribe_stats_by_user()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  today_count bigint,
  this_week_count bigint,
  this_month_count bigint,
  all_time_count bigint,
  last_consultation_at timestamptz,
  total_duration_seconds bigint,
  total_words bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_start timestamptz;
  week_start timestamptz;
  month_start timestamptz;
BEGIN
  -- Calculate date boundaries
  today_start := date_trunc('day', now());
  -- Week start (Monday) - use ISO week
  week_start := date_trunc('week', now());
  month_start := date_trunc('month', now());
  
  RETURN QUERY
  SELECT
    gc.user_id,
    COALESCE(u.email, 'Unknown') AS email,
    p.full_name,
    COUNT(*) FILTER (WHERE gc.created_at >= today_start) AS today_count,
    COUNT(*) FILTER (WHERE gc.created_at >= week_start) AS this_week_count,
    COUNT(*) FILTER (WHERE gc.created_at >= month_start) AS this_month_count,
    COUNT(*) AS all_time_count,
    MAX(gc.created_at) AS last_consultation_at,
    COALESCE(SUM(gc.duration_seconds), 0)::bigint AS total_duration_seconds,
    COALESCE(SUM(gc.word_count), 0)::bigint AS total_words
  FROM public.gp_consultations gc
  LEFT JOIN auth.users u ON u.id = gc.user_id
  LEFT JOIN public.profiles p ON p.user_id = gc.user_id
  WHERE gc.status = 'completed'
  GROUP BY gc.user_id, u.email, p.full_name
  HAVING COUNT(*) > 0;
END;
$$;