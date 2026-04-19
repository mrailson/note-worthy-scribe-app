CREATE OR REPLACE FUNCTION public.admin_list_user_generated_images()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  image_url text,
  prompt text,
  title text,
  category text,
  source text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: system admin role required';
  END IF;

  RETURN QUERY
  SELECT u.id, u.user_id, u.image_url, u.prompt, u.title, u.category, u.source, u.created_at
  FROM public.user_generated_images u
  ORDER BY u.created_at DESC
  LIMIT 1000;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_user_generated_images() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_user_generated_images() TO authenticated;