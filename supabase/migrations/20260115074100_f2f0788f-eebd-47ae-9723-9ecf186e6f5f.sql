-- Function to get large AI4GP searches with content type detection
CREATE OR REPLACE FUNCTION public.get_large_ai4gp_searches(min_size_mb numeric DEFAULT 1)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  title text,
  size_bytes bigint,
  created_at timestamptz,
  updated_at timestamptz,
  is_protected boolean,
  is_flagged boolean,
  has_audio boolean,
  has_presentation boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    COALESCE(p.email, 'Unknown') as email,
    COALESCE(p.full_name, '') as full_name,
    s.title,
    pg_column_size(s.messages)::bigint as size_bytes,
    s.created_at,
    s.updated_at,
    COALESCE(s.is_protected, false) as is_protected,
    COALESCE(s.is_flagged, false) as is_flagged,
    -- Detect if messages contain audio content (base64 encoded MP3)
    (s.messages::text LIKE '%"audioContent"%' OR s.messages::text LIKE '%generatedAudio%') as has_audio,
    -- Detect if messages contain presentation content
    (s.messages::text LIKE '%"pptxBase64"%' OR s.messages::text LIKE '%generatedPresentation%' OR s.messages::text LIKE '%downloadUrl%') as has_presentation
  FROM ai_4_pm_searches s
  LEFT JOIN profiles p ON s.user_id = p.id
  WHERE pg_column_size(s.messages) >= (min_size_mb * 1024 * 1024)
  ORDER BY pg_column_size(s.messages) DESC;
END;
$$;