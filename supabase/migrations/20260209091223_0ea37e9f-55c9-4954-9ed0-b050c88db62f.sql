
CREATE OR REPLACE FUNCTION public.get_presentation_usage_report()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  total_presentations bigint,
  total_slides bigint,
  avg_slides_per_presentation numeric,
  last_24h bigint,
  last_7d bigint,
  last_30d bigint,
  last_created timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_presentations AS (
    -- Source 1: Complaint training presentations from complaint_audio_overviews
    SELECT 
      cao.created_by AS pres_user_id,
      cao.created_at::timestamptz AS pres_created_at,
      cao.updated_at::timestamptz AS pres_updated_at,
      COALESCE(cao.powerpoint_slide_count, 0)::int AS slide_count
    FROM complaint_audio_overviews cao
    WHERE cao.powerpoint_download_url IS NOT NULL
      AND cao.created_by IS NOT NULL

    UNION ALL

    -- Source 2: Notebook / Presentation Studio sessions
    SELECT 
      ps.user_id AS pres_user_id,
      ps.created_at::timestamptz AS pres_created_at,
      ps.updated_at::timestamptz AS pres_updated_at,
      COALESCE(ps.slide_count, 0)::int AS slide_count
    FROM presentation_sessions ps
  ),
  presentation_stats AS (
    SELECT 
      ap.pres_user_id,
      COUNT(*)::bigint AS pres_count,
      COALESCE(SUM(ap.slide_count), 0)::bigint AS total_slide_count,
      COUNT(*) FILTER (WHERE ap.pres_created_at >= NOW() - INTERVAL '24 hours')::bigint AS last_24h,
      COUNT(*) FILTER (WHERE ap.pres_created_at >= NOW() - INTERVAL '7 days')::bigint AS last_7d,
      COUNT(*) FILTER (WHERE ap.pres_created_at >= NOW() - INTERVAL '30 days')::bigint AS last_30d,
      MAX(ap.pres_updated_at) AS last_created
    FROM all_presentations ap
    GROUP BY ap.pres_user_id
  )
  SELECT 
    ps2.pres_user_id AS user_id,
    COALESCE(p.email, u.email, 'Unknown')::text AS email,
    p.full_name::text AS full_name,
    ps2.pres_count AS total_presentations,
    ps2.total_slide_count AS total_slides,
    CASE WHEN ps2.pres_count > 0 
         THEN ROUND(ps2.total_slide_count::numeric / ps2.pres_count, 1) 
         ELSE 0 
    END AS avg_slides_per_presentation,
    ps2.last_24h,
    ps2.last_7d,
    ps2.last_30d,
    ps2.last_created
  FROM presentation_stats ps2
  LEFT JOIN profiles p ON ps2.pres_user_id = p.user_id
  LEFT JOIN auth.users u ON ps2.pres_user_id = u.id
  ORDER BY ps2.pres_count DESC;
END;
$$;
