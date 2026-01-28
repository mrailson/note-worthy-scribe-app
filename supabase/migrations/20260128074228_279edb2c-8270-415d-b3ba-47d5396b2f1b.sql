-- Create function to get translation usage report
CREATE OR REPLACE FUNCTION public.get_translation_usage_report()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  total_sessions bigint,
  total_messages bigint,
  languages_used text[],
  last_24h bigint,
  last_7d bigint,
  last_30d bigint,
  last_session_at timestamptz,
  avg_messages_per_session numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.user_id,
    COALESCE(p.email, 'Unknown') as email,
    p.full_name,
    COUNT(DISTINCT s.id)::bigint as total_sessions,
    COALESCE(SUM(s.total_messages), 0)::bigint as total_messages,
    ARRAY_AGG(DISTINCT s.patient_language) FILTER (WHERE s.patient_language IS NOT NULL) as languages_used,
    COUNT(DISTINCT s.id) FILTER (WHERE s.created_at >= NOW() - INTERVAL '24 hours')::bigint as last_24h,
    COUNT(DISTINCT s.id) FILTER (WHERE s.created_at >= NOW() - INTERVAL '7 days')::bigint as last_7d,
    COUNT(DISTINCT s.id) FILTER (WHERE s.created_at >= NOW() - INTERVAL '30 days')::bigint as last_30d,
    MAX(s.created_at) as last_session_at,
    ROUND(COALESCE(SUM(s.total_messages)::numeric / NULLIF(COUNT(DISTINCT s.id), 0), 0), 1) as avg_messages_per_session
  FROM reception_translation_sessions s
  LEFT JOIN profiles p ON s.user_id = p.id
  GROUP BY s.user_id, p.email, p.full_name
  ORDER BY total_sessions DESC;
END;
$$;