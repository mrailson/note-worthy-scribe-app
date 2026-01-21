-- Fix ambiguous column reference in get_genie_usage_report
DROP FUNCTION IF EXISTS public.get_genie_usage_report();

CREATE OR REPLACE FUNCTION public.get_genie_usage_report()
RETURNS TABLE (
  out_user_id uuid,
  out_email text,
  out_full_name text,
  out_ai4gp_count bigint,
  out_gp_genie_count bigint,
  out_pm_genie_count bigint,
  out_patient_line_count bigint,
  out_total_chats bigint,
  out_total_messages bigint,
  out_last_24h bigint,
  out_last_7d bigint,
  out_last_30d bigint,
  out_last_active timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ai4gp_stats AS (
    SELECT 
      a.user_id as uid,
      COUNT(*)::bigint as chat_count,
      COALESCE(SUM(jsonb_array_length(a.messages)), 0)::bigint as msg_count,
      COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '24 hours')::bigint as h24,
      COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '7 days')::bigint as d7,
      COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '30 days')::bigint as d30,
      MAX(a.updated_at) as last_act
    FROM ai_4_pm_searches a
    GROUP BY a.user_id
  ),
  genie_stats AS (
    SELECT 
      g.user_id as uid,
      COUNT(*) FILTER (WHERE g.service_type = 'gp-genie')::bigint as gp_count,
      COUNT(*) FILTER (WHERE g.service_type = 'pm-genie')::bigint as pm_count,
      COUNT(*) FILTER (WHERE g.service_type = 'patient-line')::bigint as pl_count,
      COUNT(*)::bigint as total_count,
      COALESCE(SUM(jsonb_array_length(g.messages)), 0)::bigint as msg_count,
      COUNT(*) FILTER (WHERE g.start_time >= NOW() - INTERVAL '24 hours')::bigint as h24,
      COUNT(*) FILTER (WHERE g.start_time >= NOW() - INTERVAL '7 days')::bigint as d7,
      COUNT(*) FILTER (WHERE g.start_time >= NOW() - INTERVAL '30 days')::bigint as d30,
      MAX(g.end_time) as last_act
    FROM genie_sessions g
    GROUP BY g.user_id
  ),
  all_users AS (
    SELECT uid FROM ai4gp_stats
    UNION
    SELECT uid FROM genie_stats
  )
  SELECT 
    au.uid as out_user_id,
    COALESCE(p.email, u.email, 'Unknown')::text as out_email,
    p.full_name::text as out_full_name,
    COALESCE(a4.chat_count, 0)::bigint as out_ai4gp_count,
    COALESCE(gs.gp_count, 0)::bigint as out_gp_genie_count,
    COALESCE(gs.pm_count, 0)::bigint as out_pm_genie_count,
    COALESCE(gs.pl_count, 0)::bigint as out_patient_line_count,
    (COALESCE(a4.chat_count, 0) + COALESCE(gs.total_count, 0))::bigint as out_total_chats,
    (COALESCE(a4.msg_count, 0) + COALESCE(gs.msg_count, 0))::bigint as out_total_messages,
    (COALESCE(a4.h24, 0) + COALESCE(gs.h24, 0))::bigint as out_last_24h,
    (COALESCE(a4.d7, 0) + COALESCE(gs.d7, 0))::bigint as out_last_7d,
    (COALESCE(a4.d30, 0) + COALESCE(gs.d30, 0))::bigint as out_last_30d,
    GREATEST(a4.last_act, gs.last_act) as out_last_active
  FROM all_users au
  LEFT JOIN ai4gp_stats a4 ON au.uid = a4.uid
  LEFT JOIN genie_stats gs ON au.uid = gs.uid
  LEFT JOIN profiles p ON au.uid = p.user_id
  LEFT JOIN auth.users u ON au.uid = u.id
  ORDER BY (COALESCE(a4.chat_count, 0) + COALESCE(gs.total_count, 0)) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_genie_usage_report() TO authenticated;