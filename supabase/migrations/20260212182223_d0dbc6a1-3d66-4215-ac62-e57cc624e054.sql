CREATE OR REPLACE FUNCTION public.get_meeting_usage_report()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  last_24h BIGINT,
  last_7d BIGINT,
  last_30d BIGINT,
  all_time BIGINT,
  avg_duration_mins NUMERIC,
  total_duration_mins BIGINT,
  total_words BIGINT,
  deleted_meetings_count BIGINT,
  duration_24h BIGINT,
  duration_7d BIGINT,
  duration_30d BIGINT,
  words_24h BIGINT,
  words_7d BIGINT,
  words_30d BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH users_list AS (
    SELECT 
      au.id as uid,
      au.email::text as uemail,
      (au.raw_user_meta_data->>'full_name')::text as ufull_name
    FROM auth.users au
    WHERE au.deleted_at IS NULL
  ),
  meeting_stats AS (
    SELECT 
      m.user_id as ms_user_id,
      COUNT(*) FILTER (WHERE m.created_at::date = CURRENT_DATE) as last_24h,
      COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days') as last_7d,
      COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '30 days') as last_30d,
      COUNT(*) as all_time,
      ROUND(AVG(COALESCE(m.duration_minutes, 0)), 0) as avg_duration_mins,
      SUM(COALESCE(m.duration_minutes, 0)) as total_duration_mins,
      SUM(COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0)) as total_words,
      SUM(COALESCE(m.duration_minutes, 0)) FILTER (WHERE m.created_at::date = CURRENT_DATE) as duration_24h,
      SUM(COALESCE(m.duration_minutes, 0)) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days') as duration_7d,
      SUM(COALESCE(m.duration_minutes, 0)) FILTER (WHERE m.created_at >= NOW() - INTERVAL '30 days') as duration_30d,
      SUM(COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0)) FILTER (WHERE m.created_at::date = CURRENT_DATE) as words_24h,
      SUM(COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0)) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days') as words_7d,
      SUM(COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0)) FILTER (WHERE m.created_at >= NOW() - INTERVAL '30 days') as words_30d
    FROM public.meetings m
    WHERE m.status = 'completed'
      AND COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0) >= 100
    GROUP BY m.user_id
  ),
  deleted_stats AS (
    SELECT 
      ma.user_id as ds_user_id,
      COUNT(*) as deleted_count
    FROM public.meetings_archive ma
    WHERE ma.word_count >= 500
    GROUP BY ma.user_id
  )
  SELECT 
    u.uid,
    u.uemail,
    u.ufull_name,
    COALESCE(ms.last_24h, 0)::BIGINT,
    COALESCE(ms.last_7d, 0)::BIGINT,
    COALESCE(ms.last_30d, 0)::BIGINT,
    (COALESCE(ms.all_time, 0) + COALESCE(ds.deleted_count, 0))::BIGINT,
    COALESCE(ms.avg_duration_mins, 0)::NUMERIC,
    COALESCE(ms.total_duration_mins, 0)::BIGINT,
    COALESCE(ms.total_words, 0)::BIGINT,
    COALESCE(ds.deleted_count, 0)::BIGINT,
    COALESCE(ms.duration_24h, 0)::BIGINT,
    COALESCE(ms.duration_7d, 0)::BIGINT,
    COALESCE(ms.duration_30d, 0)::BIGINT,
    COALESCE(ms.words_24h, 0)::BIGINT,
    COALESCE(ms.words_7d, 0)::BIGINT,
    COALESCE(ms.words_30d, 0)::BIGINT
  FROM users_list u
  LEFT JOIN meeting_stats ms ON u.uid = ms.ms_user_id
  LEFT JOIN deleted_stats ds ON u.uid = ds.ds_user_id
  WHERE COALESCE(ms.all_time, 0) > 0 OR COALESCE(ds.deleted_count, 0) > 0
  ORDER BY COALESCE(ms.all_time, 0) DESC;
END;
$$;