-- Drop existing functions and recreate with correct data sources
DROP FUNCTION IF EXISTS public.get_genie_usage_report();
DROP FUNCTION IF EXISTS public.get_presentation_usage_report();

-- Recreate get_genie_usage_report to include AI4GP main chat (ai_4_pm_searches)
CREATE OR REPLACE FUNCTION public.get_genie_usage_report()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  ai4gp_count bigint,
  gp_genie_count bigint,
  pm_genie_count bigint,
  patient_line_count bigint,
  total_chats bigint,
  total_messages bigint,
  last_24h bigint,
  last_7d bigint,
  last_30d bigint,
  last_active timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ai4gp_stats AS (
    -- AI4GP main chat from ai_4_pm_searches
    SELECT 
      a.user_id,
      COUNT(*)::bigint as chat_count,
      COALESCE(SUM(jsonb_array_length(a.messages)), 0)::bigint as msg_count,
      COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '24 hours')::bigint as last_24h,
      COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '7 days')::bigint as last_7d,
      COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '30 days')::bigint as last_30d,
      MAX(a.updated_at) as last_active
    FROM ai_4_pm_searches a
    GROUP BY a.user_id
  ),
  genie_stats AS (
    -- Genie services from genie_sessions
    SELECT 
      g.user_id,
      COUNT(*) FILTER (WHERE g.service_type = 'gp-genie')::bigint as gp_count,
      COUNT(*) FILTER (WHERE g.service_type = 'pm-genie')::bigint as pm_count,
      COUNT(*) FILTER (WHERE g.service_type = 'patient-line')::bigint as pl_count,
      COUNT(*)::bigint as total_count,
      COALESCE(SUM(jsonb_array_length(g.messages)), 0)::bigint as msg_count,
      COUNT(*) FILTER (WHERE g.start_time >= NOW() - INTERVAL '24 hours')::bigint as last_24h,
      COUNT(*) FILTER (WHERE g.start_time >= NOW() - INTERVAL '7 days')::bigint as last_7d,
      COUNT(*) FILTER (WHERE g.start_time >= NOW() - INTERVAL '30 days')::bigint as last_30d,
      MAX(g.end_time) as last_active
    FROM genie_sessions g
    GROUP BY g.user_id
  ),
  all_users AS (
    SELECT user_id FROM ai4gp_stats
    UNION
    SELECT user_id FROM genie_stats
  )
  SELECT 
    au.user_id,
    COALESCE(p.email, u.email, 'Unknown')::text as email,
    p.full_name::text as full_name,
    COALESCE(a4.chat_count, 0)::bigint as ai4gp_count,
    COALESCE(gs.gp_count, 0)::bigint as gp_genie_count,
    COALESCE(gs.pm_count, 0)::bigint as pm_genie_count,
    COALESCE(gs.pl_count, 0)::bigint as patient_line_count,
    (COALESCE(a4.chat_count, 0) + COALESCE(gs.total_count, 0))::bigint as total_chats,
    (COALESCE(a4.msg_count, 0) + COALESCE(gs.msg_count, 0))::bigint as total_messages,
    (COALESCE(a4.last_24h, 0) + COALESCE(gs.last_24h, 0))::bigint as last_24h,
    (COALESCE(a4.last_7d, 0) + COALESCE(gs.last_7d, 0))::bigint as last_7d,
    (COALESCE(a4.last_30d, 0) + COALESCE(gs.last_30d, 0))::bigint as last_30d,
    GREATEST(a4.last_active, gs.last_active) as last_active
  FROM all_users au
  LEFT JOIN ai4gp_stats a4 ON au.user_id = a4.user_id
  LEFT JOIN genie_stats gs ON au.user_id = gs.user_id
  LEFT JOIN profiles p ON au.user_id = p.user_id
  LEFT JOIN auth.users u ON au.user_id = u.id
  ORDER BY (COALESCE(a4.chat_count, 0) + COALESCE(gs.total_count, 0)) DESC;
END;
$$;

-- Recreate get_presentation_usage_report to extract from ai_4_pm_searches messages
CREATE OR REPLACE FUNCTION public.get_presentation_usage_report()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  total_presentations bigint,
  total_slides bigint,
  avg_slides_per_presentation numeric,
  last_24h bigint,
  last_7d bigint,
  last_30d bigint,
  last_created timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH presentation_data AS (
    -- Extract presentations from ai_4_pm_searches messages
    SELECT 
      a.user_id,
      a.created_at,
      a.updated_at,
      (msg->>'slideCount')::int as slide_count
    FROM ai_4_pm_searches a,
         jsonb_array_elements(a.messages) as msg
    WHERE msg->>'generatedPresentation' IS NOT NULL
       OR msg->'generatedPresentation' IS NOT NULL
       OR (msg->>'content' LIKE '%Slides:%' AND msg->>'role' = 'assistant')
  ),
  presentation_stats AS (
    SELECT 
      pd.user_id,
      COUNT(*)::bigint as pres_count,
      COALESCE(SUM(COALESCE(pd.slide_count, 10)), 0)::bigint as total_slides,
      COUNT(*) FILTER (WHERE pd.created_at >= NOW() - INTERVAL '24 hours')::bigint as last_24h,
      COUNT(*) FILTER (WHERE pd.created_at >= NOW() - INTERVAL '7 days')::bigint as last_7d,
      COUNT(*) FILTER (WHERE pd.created_at >= NOW() - INTERVAL '30 days')::bigint as last_30d,
      MAX(pd.updated_at) as last_created
    FROM presentation_data pd
    GROUP BY pd.user_id
  )
  SELECT 
    ps.user_id,
    COALESCE(p.email, u.email, 'Unknown')::text as email,
    p.full_name::text as full_name,
    ps.pres_count::bigint as total_presentations,
    ps.total_slides::bigint as total_slides,
    CASE WHEN ps.pres_count > 0 
         THEN ROUND(ps.total_slides::numeric / ps.pres_count, 1) 
         ELSE 0 
    END as avg_slides_per_presentation,
    ps.last_24h::bigint as last_24h,
    ps.last_7d::bigint as last_7d,
    ps.last_30d::bigint as last_30d,
    ps.last_created as last_created
  FROM presentation_stats ps
  LEFT JOIN profiles p ON ps.user_id = p.user_id
  LEFT JOIN auth.users u ON ps.user_id = u.id
  ORDER BY ps.pres_count DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_genie_usage_report() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_presentation_usage_report() TO authenticated;