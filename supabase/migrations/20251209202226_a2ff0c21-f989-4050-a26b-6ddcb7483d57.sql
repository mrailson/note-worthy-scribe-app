-- Create meetings_archive table for tracking deleted meetings
CREATE TABLE public.meetings_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_meeting_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT,
  duration_minutes INTEGER,
  word_count INTEGER,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  original_created_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.meetings_archive ENABLE ROW LEVEL SECURITY;

-- Create policy using the is_system_admin function
CREATE POLICY "System admins can view archived meetings"
ON public.meetings_archive
FOR SELECT
USING (is_system_admin(auth.uid()));

-- Create trigger to archive meetings before delete
CREATE OR REPLACE FUNCTION archive_meeting_before_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.duration_minutes >= 5 THEN
    INSERT INTO public.meetings_archive (
      original_meeting_id,
      user_id,
      title,
      duration_minutes,
      word_count,
      original_created_at
    ) VALUES (
      OLD.id,
      OLD.user_id,
      OLD.title,
      OLD.duration_minutes,
      OLD.word_count,
      OLD.created_at
    );
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS archive_meeting_on_delete ON meetings;
CREATE TRIGGER archive_meeting_on_delete
  BEFORE DELETE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION archive_meeting_before_delete();

-- Recreate the usage report function
DROP FUNCTION IF EXISTS get_meeting_usage_report();
CREATE OR REPLACE FUNCTION get_meeting_usage_report()
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
  deleted_meetings_count BIGINT
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
      SUM(COALESCE(m.word_count, 0)) as total_words
    FROM meetings m
    WHERE m.status = 'completed'
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
    COALESCE(dc.deleted_count, 0)::bigint as deleted_meetings_count
  FROM meeting_stats ms
  FULL OUTER JOIN deleted_counts dc ON ms.user_id = dc.user_id
  LEFT JOIN profiles p ON COALESCE(ms.user_id, dc.user_id) = p.user_id
  WHERE COALESCE(ms.all_time, 0) > 0 OR COALESCE(dc.deleted_count, 0) > 0
  ORDER BY COALESCE(ms.all_time, 0) DESC;
END;
$$;