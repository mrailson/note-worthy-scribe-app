-- Function to get storage usage breakdown by user
CREATE OR REPLACE FUNCTION public.get_storage_by_user()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  ai_chats_count bigint,
  ai_chats_size_bytes bigint,
  transcript_chunks_count bigint,
  transcript_size_bytes bigint,
  meetings_count bigint,
  total_size_bytes bigint,
  oldest_ai_chat timestamp with time zone,
  oldest_meeting timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH ai_stats AS (
    SELECT 
      a.user_id,
      COUNT(*) as chat_count,
      COALESCE(SUM(LENGTH(CAST(a.messages AS TEXT))), 0) as size_bytes,
      MIN(a.created_at) as oldest
    FROM ai_4_pm_searches a
    GROUP BY a.user_id
  ),
  transcript_stats AS (
    SELECT 
      mtc.user_id,
      COUNT(*) as chunk_count,
      COALESCE(SUM(LENGTH(COALESCE(mtc.transcription_text, '')) + LENGTH(COALESCE(mtc.cleaned_text, ''))), 0) as size_bytes
    FROM meeting_transcription_chunks mtc
    GROUP BY mtc.user_id
  ),
  meeting_stats AS (
    SELECT 
      m.user_id,
      COUNT(*) as meeting_count,
      MIN(m.created_at) as oldest
    FROM meetings m
    GROUP BY m.user_id
  )
  SELECT 
    p.user_id,
    p.email,
    p.full_name,
    COALESCE(ai.chat_count, 0)::bigint as ai_chats_count,
    COALESCE(ai.size_bytes, 0)::bigint as ai_chats_size_bytes,
    COALESCE(ts.chunk_count, 0)::bigint as transcript_chunks_count,
    COALESCE(ts.size_bytes, 0)::bigint as transcript_size_bytes,
    COALESCE(ms.meeting_count, 0)::bigint as meetings_count,
    (COALESCE(ai.size_bytes, 0) + COALESCE(ts.size_bytes, 0))::bigint as total_size_bytes,
    ai.oldest as oldest_ai_chat,
    ms.oldest as oldest_meeting
  FROM profiles p
  LEFT JOIN ai_stats ai ON p.user_id = ai.user_id
  LEFT JOIN transcript_stats ts ON p.user_id = ts.user_id
  LEFT JOIN meeting_stats ms ON p.user_id = ms.user_id
  WHERE COALESCE(ai.size_bytes, 0) + COALESCE(ts.size_bytes, 0) > 0
  ORDER BY (COALESCE(ai.size_bytes, 0) + COALESCE(ts.size_bytes, 0)) DESC;
END;
$$;

-- Function to get largest AI chats
CREATE OR REPLACE FUNCTION public.get_largest_ai_chats(limit_count integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  title text,
  user_id uuid,
  email text,
  size_bytes bigint,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  is_protected boolean,
  is_flagged boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.user_id,
    p.email,
    LENGTH(CAST(a.messages AS TEXT))::bigint as size_bytes,
    a.created_at,
    a.updated_at,
    COALESCE(a.is_protected, false) as is_protected,
    COALESCE(a.is_flagged, false) as is_flagged
  FROM ai_4_pm_searches a
  LEFT JOIN profiles p ON a.user_id = p.user_id
  ORDER BY LENGTH(CAST(a.messages AS TEXT)) DESC
  LIMIT limit_count;
END;
$$;

-- Function to get old AI chats (cleanup candidates)
CREATE OR REPLACE FUNCTION public.get_old_ai_chats(days_old integer DEFAULT 90)
RETURNS TABLE(
  id uuid,
  title text,
  user_id uuid,
  email text,
  size_bytes bigint,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  is_protected boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.user_id,
    p.email,
    LENGTH(CAST(a.messages AS TEXT))::bigint as size_bytes,
    a.created_at,
    a.updated_at,
    COALESCE(a.is_protected, false) as is_protected
  FROM ai_4_pm_searches a
  LEFT JOIN profiles p ON a.user_id = p.user_id
  WHERE a.updated_at < NOW() - (days_old || ' days')::interval
    AND COALESCE(a.is_protected, false) = false
  ORDER BY LENGTH(CAST(a.messages AS TEXT)) DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_storage_by_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_largest_ai_chats(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_old_ai_chats(integer) TO authenticated;