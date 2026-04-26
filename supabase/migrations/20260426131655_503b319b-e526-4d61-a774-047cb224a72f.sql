CREATE TABLE IF NOT EXISTS public.image_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_id TEXT NOT NULL,
  model TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  prompt_final TEXT NOT NULL,
  additional_requirements TEXT,
  image_url TEXT NOT NULL,
  regeneration_of_id UUID REFERENCES public.image_generations(id) ON DELETE SET NULL,
  advanced_opened BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.image_generations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_image_generations_user_created_at
ON public.image_generations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_generations_template_created_at
ON public.image_generations(template_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_generations_regeneration_of_id
ON public.image_generations(regeneration_of_id)
WHERE regeneration_of_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can view their own image generations" ON public.image_generations;
CREATE POLICY "Users can view their own image generations"
ON public.image_generations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own image generations" ON public.image_generations;
CREATE POLICY "Users can create their own image generations"
ON public.image_generations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System admins can view all image generations" ON public.image_generations;
CREATE POLICY "System admins can view all image generations"
ON public.image_generations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'system_admin'));

CREATE OR REPLACE FUNCTION public.get_ask_ai_image_studio_usage_report()
RETURNS TABLE (
  template_id TEXT,
  total_generations BIGINT,
  regeneration_count BIGINT,
  regeneration_rate NUMERIC,
  advanced_opened_count BIGINT,
  advanced_opened_rate NUMERIC,
  unique_users BIGINT,
  last_generated TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ig.template_id,
    COUNT(*) AS total_generations,
    COUNT(*) FILTER (WHERE ig.regeneration_of_id IS NOT NULL) AS regeneration_count,
    ROUND((COUNT(*) FILTER (WHERE ig.regeneration_of_id IS NOT NULL)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1) AS regeneration_rate,
    COUNT(*) FILTER (WHERE ig.advanced_opened) AS advanced_opened_count,
    ROUND((COUNT(*) FILTER (WHERE ig.advanced_opened)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1) AS advanced_opened_rate,
    COUNT(DISTINCT ig.user_id) AS unique_users,
    MAX(ig.created_at) AS last_generated
  FROM public.image_generations ig
  GROUP BY ig.template_id
  ORDER BY total_generations DESC, template_id ASC;
$$;

REVOKE ALL ON FUNCTION public.get_ask_ai_image_studio_usage_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ask_ai_image_studio_usage_report() TO authenticated;