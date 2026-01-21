-- Create RPC function to get Genie usage report (GP Genie, PM Genie, Patient Line)
CREATE OR REPLACE FUNCTION public.get_genie_usage_report()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  gp_genie_count bigint,
  pm_genie_count bigint,
  patient_line_count bigint,
  total_chats bigint,
  total_messages bigint,
  total_duration_seconds bigint,
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
  SELECT 
    gs.user_id,
    COALESCE(p.email, au.email, 'Unknown') AS email,
    p.full_name,
    COALESCE(SUM(CASE WHEN gs.service_type = 'gp-genie' THEN 1 ELSE 0 END), 0) AS gp_genie_count,
    COALESCE(SUM(CASE WHEN gs.service_type = 'pm-genie' THEN 1 ELSE 0 END), 0) AS pm_genie_count,
    COALESCE(SUM(CASE WHEN gs.service_type = 'patient-line' THEN 1 ELSE 0 END), 0) AS patient_line_count,
    COUNT(*)::bigint AS total_chats,
    COALESCE(SUM(gs.message_count), 0)::bigint AS total_messages,
    COALESCE(SUM(gs.duration_seconds), 0)::bigint AS total_duration_seconds,
    COALESCE(SUM(CASE WHEN gs.created_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END), 0) AS last_24h,
    COALESCE(SUM(CASE WHEN gs.created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END), 0) AS last_7d,
    COALESCE(SUM(CASE WHEN gs.created_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END), 0) AS last_30d,
    MAX(gs.created_at) AS last_active
  FROM genie_sessions gs
  LEFT JOIN profiles p ON gs.user_id = p.user_id
  LEFT JOIN auth.users au ON gs.user_id = au.id
  GROUP BY gs.user_id, p.email, au.email, p.full_name
  ORDER BY COUNT(*) DESC;
END;
$$;

-- Create RPC function to get Image Studio usage report
CREATE OR REPLACE FUNCTION public.get_image_usage_report()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  image_studio_count bigint,
  quick_pick_count bigint,
  infographic_count bigint,
  total_images bigint,
  last_24h bigint,
  last_7d bigint,
  last_30d bigint,
  last_generated timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ugi.user_id,
    COALESCE(p.email, au.email, 'Unknown') AS email,
    p.full_name,
    COALESCE(SUM(CASE WHEN ugi.source = 'image-studio' THEN 1 ELSE 0 END), 0) AS image_studio_count,
    COALESCE(SUM(CASE WHEN ugi.source = 'quick-pick' OR ugi.source IS NULL THEN 1 ELSE 0 END), 0) AS quick_pick_count,
    COALESCE(SUM(CASE WHEN ugi.source = 'infographic' THEN 1 ELSE 0 END), 0) AS infographic_count,
    COUNT(*)::bigint AS total_images,
    COALESCE(SUM(CASE WHEN ugi.created_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END), 0) AS last_24h,
    COALESCE(SUM(CASE WHEN ugi.created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END), 0) AS last_7d,
    COALESCE(SUM(CASE WHEN ugi.created_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END), 0) AS last_30d,
    MAX(ugi.created_at) AS last_generated
  FROM user_generated_images ugi
  LEFT JOIN profiles p ON ugi.user_id = p.user_id
  LEFT JOIN auth.users au ON ugi.user_id = au.id
  GROUP BY ugi.user_id, p.email, au.email, p.full_name
  ORDER BY COUNT(*) DESC;
END;
$$;

-- Create RPC function to get Presentation Studio usage report
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
  SELECT 
    ps.user_id,
    COALESCE(p.email, au.email, 'Unknown') AS email,
    p.full_name,
    COUNT(*)::bigint AS total_presentations,
    COALESCE(SUM(ps.slide_count), 0)::bigint AS total_slides,
    ROUND(AVG(ps.slide_count)::numeric, 1) AS avg_slides_per_presentation,
    COALESCE(SUM(CASE WHEN ps.created_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END), 0) AS last_24h,
    COALESCE(SUM(CASE WHEN ps.created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END), 0) AS last_7d,
    COALESCE(SUM(CASE WHEN ps.created_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END), 0) AS last_30d,
    MAX(ps.created_at) AS last_created
  FROM presentation_sessions ps
  LEFT JOIN profiles p ON ps.user_id = p.user_id
  LEFT JOIN auth.users au ON ps.user_id = au.id
  GROUP BY ps.user_id, p.email, au.email, p.full_name
  ORDER BY COUNT(*) DESC;
END;
$$;