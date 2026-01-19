-- Fix function search_path for security (prevents search_path injection attacks)
-- Need to drop and recreate functions with matching signatures

-- Fix get_largest_ai_chats function
DROP FUNCTION IF EXISTS public.get_largest_ai_chats(integer);
CREATE FUNCTION public.get_largest_ai_chats(limit_count integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  title text,
  user_id uuid,
  email text,
  size_bytes bigint,
  created_at timestamptz,
  updated_at timestamptz,
  is_protected boolean,
  is_flagged boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT 
    s.id,
    s.title,
    s.user_id,
    p.email,
    pg_column_size(s.messages)::bigint as size_bytes,
    s.created_at,
    s.updated_at,
    COALESCE(s.is_protected, false) as is_protected,
    COALESCE(s.is_flagged, false) as is_flagged
  FROM ai_4_pm_searches s
  LEFT JOIN profiles p ON s.user_id = p.user_id
  ORDER BY pg_column_size(s.messages) DESC
  LIMIT limit_count;
$$;

-- Fix get_old_ai_chats function
DROP FUNCTION IF EXISTS public.get_old_ai_chats(integer);
CREATE FUNCTION public.get_old_ai_chats(days_old integer DEFAULT 90)
RETURNS TABLE(
  id uuid,
  title text,
  user_id uuid,
  email text,
  size_bytes bigint,
  created_at timestamptz,
  updated_at timestamptz,
  is_protected boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT 
    s.id,
    s.title,
    s.user_id,
    p.email,
    pg_column_size(s.messages)::bigint as size_bytes,
    s.created_at,
    s.updated_at,
    COALESCE(s.is_protected, false) as is_protected
  FROM ai_4_pm_searches s
  LEFT JOIN profiles p ON s.user_id = p.user_id
  WHERE s.updated_at < (now() - (days_old || ' days')::interval)
  ORDER BY s.updated_at ASC;
$$;

-- Fix get_storage_by_user function
DROP FUNCTION IF EXISTS public.get_storage_by_user();
CREATE FUNCTION public.get_storage_by_user()
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
  oldest_ai_chat timestamptz,
  oldest_meeting timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT 
    p.user_id,
    p.email,
    p.full_name,
    COALESCE(ai.chat_count, 0)::bigint as ai_chats_count,
    COALESCE(ai.total_size, 0)::bigint as ai_chats_size_bytes,
    COALESCE(tc.chunk_count, 0)::bigint as transcript_chunks_count,
    COALESCE(tc.total_size, 0)::bigint as transcript_size_bytes,
    COALESCE(m.meeting_count, 0)::bigint as meetings_count,
    (COALESCE(ai.total_size, 0) + COALESCE(tc.total_size, 0))::bigint as total_size_bytes,
    ai.oldest_chat as oldest_ai_chat,
    m.oldest_meeting as oldest_meeting
  FROM profiles p
  LEFT JOIN (
    SELECT user_id, COUNT(*) as chat_count, SUM(pg_column_size(messages)) as total_size, MIN(created_at) as oldest_chat
    FROM ai_4_pm_searches
    GROUP BY user_id
  ) ai ON p.user_id = ai.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) as chunk_count, SUM(pg_column_size(transcript_text)) as total_size
    FROM assembly_transcripts
    GROUP BY user_id
  ) tc ON p.user_id = tc.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) as meeting_count, MIN(created_at) as oldest_meeting
    FROM meetings
    GROUP BY user_id
  ) m ON p.user_id = m.user_id
  ORDER BY total_size_bytes DESC;
$$;

-- Fix update_distribution_lists_updated_at function
CREATE OR REPLACE FUNCTION public.update_distribution_lists_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;