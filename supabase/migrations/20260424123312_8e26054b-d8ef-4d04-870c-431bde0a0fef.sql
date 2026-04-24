CREATE TABLE IF NOT EXISTS public.user_generated_images_archive (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  prompt text,
  detailed_prompt text,
  quick_pick_id text,
  alt_text text,
  image_settings jsonb,
  created_at timestamptz NOT NULL,
  is_favourite boolean,
  source text,
  category text,
  title text,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ugi_archive_user_id ON public.user_generated_images_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_ugi_archive_archived_at ON public.user_generated_images_archive(archived_at);

ALTER TABLE public.user_generated_images_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own archived images"
ON public.user_generated_images_archive
FOR SELECT
USING (auth.uid() = user_id);

WITH moved AS (
  DELETE FROM public.user_generated_images
  WHERE created_at < (now() - interval '30 days')
  RETURNING *
)
INSERT INTO public.user_generated_images_archive (
  id, user_id, image_url, prompt, detailed_prompt, quick_pick_id,
  alt_text, image_settings, created_at, is_favourite, source, category, title
)
SELECT
  id, user_id, image_url, prompt, detailed_prompt, quick_pick_id,
  alt_text, image_settings, created_at, is_favourite, source, category, title
FROM moved;