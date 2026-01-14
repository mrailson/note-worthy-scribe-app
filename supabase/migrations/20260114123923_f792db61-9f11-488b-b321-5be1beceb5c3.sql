-- Fix get_meeting_usage_report function - remove deleted_at reference
CREATE OR REPLACE FUNCTION public.get_meeting_usage_report()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  last_24h bigint,
  last_7d bigint,
  last_30d bigint,
  all_time bigint,
  avg_duration_mins bigint,
  total_duration_mins bigint,
  total_words bigint,
  deleted_meetings_count bigint,
  duration_24h bigint,
  duration_7d bigint,
  duration_30d bigint,
  words_24h bigint,
  words_7d bigint,
  words_30d bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id as user_id,
    au.email::text as email,
    COALESCE(p.full_name, au.email::text)::text as full_name,
    COUNT(CASE WHEN m.created_at >= NOW() - INTERVAL '24 hours' AND m.word_count >= 100 THEN 1 END) as last_24h,
    COUNT(CASE WHEN m.created_at >= NOW() - INTERVAL '7 days' AND m.word_count >= 100 THEN 1 END) as last_7d,
    COUNT(CASE WHEN m.created_at >= NOW() - INTERVAL '30 days' AND m.word_count >= 100 THEN 1 END) as last_30d,
    COUNT(CASE WHEN m.word_count >= 100 THEN 1 END) as all_time,
    COALESCE(AVG(CASE WHEN m.word_count >= 100 THEN m.duration_minutes END)::bigint, 0) as avg_duration_mins,
    COALESCE(SUM(CASE WHEN m.word_count >= 100 THEN m.duration_minutes END)::bigint, 0) as total_duration_mins,
    COALESCE(SUM(CASE WHEN m.word_count >= 100 THEN m.word_count END)::bigint, 0) as total_words,
    0::bigint as deleted_meetings_count,  -- meetings table doesn't track deletions
    COALESCE(SUM(CASE WHEN m.created_at >= NOW() - INTERVAL '24 hours' AND m.word_count >= 100 THEN m.duration_minutes END)::bigint, 0) as duration_24h,
    COALESCE(SUM(CASE WHEN m.created_at >= NOW() - INTERVAL '7 days' AND m.word_count >= 100 THEN m.duration_minutes END)::bigint, 0) as duration_7d,
    COALESCE(SUM(CASE WHEN m.created_at >= NOW() - INTERVAL '30 days' AND m.word_count >= 100 THEN m.duration_minutes END)::bigint, 0) as duration_30d,
    COALESCE(SUM(CASE WHEN m.created_at >= NOW() - INTERVAL '24 hours' AND m.word_count >= 100 THEN m.word_count END)::bigint, 0) as words_24h,
    COALESCE(SUM(CASE WHEN m.created_at >= NOW() - INTERVAL '7 days' AND m.word_count >= 100 THEN m.word_count END)::bigint, 0) as words_7d,
    COALESCE(SUM(CASE WHEN m.created_at >= NOW() - INTERVAL '30 days' AND m.word_count >= 100 THEN m.word_count END)::bigint, 0) as words_30d
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  LEFT JOIN public.meetings m ON m.user_id = au.id
  WHERE m.status = 'completed'
  GROUP BY au.id, au.email, p.full_name
  HAVING COUNT(CASE WHEN m.word_count >= 100 THEN 1 END) > 0
  ORDER BY COUNT(CASE WHEN m.word_count >= 100 THEN 1 END) DESC;
END;
$$;