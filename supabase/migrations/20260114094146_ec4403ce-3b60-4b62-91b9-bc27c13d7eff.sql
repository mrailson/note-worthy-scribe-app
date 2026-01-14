-- Add duration breakdown by time period to meeting usage report
-- Drop existing function first since return type is changing
DROP FUNCTION IF EXISTS public.get_meeting_usage_report();

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
  total_words bigint,
  deleted_meetings_count bigint,
  duration_24h bigint,
  duration_7d bigint,
  duration_30d bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH deleted_counts AS (
    SELECT ma.user_id, COUNT(*) as deleted_count
    FROM meetings_archive ma
    WHERE COALESCE(ma.word_count, 0) > 100
    GROUP BY ma.user_id
  ),
  meeting_stats AS (
    SELECT 
      m.user_id,
      COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '24 hours') as last_24h,
      COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days') as last_7d,
      COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '30 days') as last_30d,
      COUNT(*) as all_time,
      ROUND(AVG(COALESCE(m.duration_minutes, 0)), 0) as avg_duration_mins,
      SUM(COALESCE(m.duration_minutes, 0)) as total_duration_mins,
      SUM(COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0)) as total_words,
      SUM(COALESCE(m.duration_minutes, 0)) FILTER (WHERE m.created_at >= NOW() - INTERVAL '24 hours') as duration_24h,
      SUM(COALESCE(m.duration_minutes, 0)) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days') as duration_7d,
      SUM(COALESCE(m.duration_minutes, 0)) FILTER (WHERE m.created_at >= NOW() - INTERVAL '30 days') as duration_30d
    FROM meetings m
    WHERE m.status = 'completed'
      AND COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0) > 100
    GROUP BY m.user_id
  )
  SELECT 
    COALESCE(ms.user_id, dc.user_id) as user_id,
    p.email,
    p.full_name,
    COALESCE(ms.last_24h, 0)::bigint,
    COALESCE(ms.last_7d, 0)::bigint,
    COALESCE(ms.last_30d, 0)::bigint,
    COALESCE(ms.all_time, 0)::bigint,
    COALESCE(ms.avg_duration_mins, 0)::numeric,
    COALESCE(ms.total_duration_mins, 0)::bigint,
    COALESCE(ms.total_words, 0)::bigint,
    COALESCE(dc.deleted_count, 0)::bigint as deleted_meetings_count,
    COALESCE(ms.duration_24h, 0)::bigint,
    COALESCE(ms.duration_7d, 0)::bigint,
    COALESCE(ms.duration_30d, 0)::bigint
  FROM meeting_stats ms
  FULL OUTER JOIN deleted_counts dc ON ms.user_id = dc.user_id
  LEFT JOIN profiles p ON COALESCE(ms.user_id, dc.user_id) = p.user_id
  WHERE COALESCE(ms.all_time, 0) > 0 OR COALESCE(dc.deleted_count, 0) > 0
  ORDER BY COALESCE(ms.all_time, 0) DESC;
END;
$$;