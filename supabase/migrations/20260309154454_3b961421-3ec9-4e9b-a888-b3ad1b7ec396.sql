-- Usage tracking table for Document Studio
CREATE TABLE public.document_studio_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'custom',
  document_type_name TEXT,
  title TEXT,
  free_form_request TEXT,
  word_count INTEGER DEFAULT 0,
  action TEXT NOT NULL DEFAULT 'generate',
  request_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.document_studio_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own usage"
  ON public.document_studio_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own usage"
  ON public.document_studio_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin RPC to get Document Studio stats by user
CREATE OR REPLACE FUNCTION public.get_document_studio_stats_by_user()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  today_count BIGINT,
  this_week_count BIGINT,
  this_month_count BIGINT,
  all_time_count BIGINT,
  total_words BIGINT,
  last_generated_at TIMESTAMPTZ,
  top_document_type TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.user_id,
    u.email,
    u.full_name,
    COALESCE(SUM(CASE WHEN u.created_at::date = CURRENT_DATE THEN 1 ELSE 0 END), 0) AS today_count,
    COALESCE(SUM(CASE WHEN u.created_at >= date_trunc('week', CURRENT_DATE) THEN 1 ELSE 0 END), 0) AS this_week_count,
    COALESCE(SUM(CASE WHEN u.created_at >= date_trunc('month', CURRENT_DATE) THEN 1 ELSE 0 END), 0) AS this_month_count,
    COUNT(*) AS all_time_count,
    COALESCE(SUM(u.word_count), 0) AS total_words,
    MAX(u.created_at) AS last_generated_at,
    (SELECT du2.document_type_name FROM public.document_studio_usage du2 
     WHERE du2.user_id = u.user_id 
     GROUP BY du2.document_type_name 
     ORDER BY COUNT(*) DESC LIMIT 1) AS top_document_type
  FROM (
    SELECT 
      dsu.user_id,
      dsu.created_at,
      dsu.word_count,
      dsu.document_type_name,
      au.email,
      p.full_name
    FROM public.document_studio_usage dsu
    JOIN auth.users au ON au.id = dsu.user_id
    LEFT JOIN public.profiles p ON p.id = dsu.user_id
  ) u
  GROUP BY u.user_id, u.email, u.full_name;
$$;

-- Admin RPC to get recent Document Studio usage for detail view
CREATE OR REPLACE FUNCTION public.get_document_studio_recent_usage(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  user_email TEXT,
  user_name TEXT,
  document_type TEXT,
  document_type_name TEXT,
  title TEXT,
  free_form_request TEXT,
  request_summary TEXT,
  word_count INTEGER,
  action TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dsu.id,
    au.email AS user_email,
    p.full_name AS user_name,
    dsu.document_type,
    dsu.document_type_name,
    dsu.title,
    dsu.free_form_request,
    dsu.request_summary,
    dsu.word_count,
    dsu.action,
    dsu.created_at
  FROM public.document_studio_usage dsu
  JOIN auth.users au ON au.id = dsu.user_id
  LEFT JOIN public.profiles p ON p.id = dsu.user_id
  ORDER BY dsu.created_at DESC
  LIMIT limit_count;
$$;