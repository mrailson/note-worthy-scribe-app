CREATE OR REPLACE FUNCTION public.get_meeting_usage_report()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  last_24h bigint,
  last_7d bigint,
  last_30d bigint,
  all_time bigint,
  avg_duration_mins numeric,
  total_duration_mins bigint,
  total_words bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.user_id,
    p.email,
    p.full_name,
    COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '24 hours')::bigint as last_24h,
    COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days')::bigint as last_7d,
    COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '30 days')::bigint as last_30d,
    COUNT(*)::bigint as all_time,
    ROUND(AVG(COALESCE(m.duration_minutes, 0)), 0) as avg_duration_mins,
    SUM(COALESCE(m.duration_minutes, 0))::bigint as total_duration_mins,
    SUM(COALESCE(m.word_count, 0))::bigint as total_words
  FROM meetings m
  LEFT JOIN profiles p ON m.user_id = p.user_id
  WHERE m.status = 'completed'
  GROUP BY m.user_id, p.email, p.full_name
  HAVING COUNT(*) > 0
  ORDER BY COUNT(*) DESC;
END;
$$;