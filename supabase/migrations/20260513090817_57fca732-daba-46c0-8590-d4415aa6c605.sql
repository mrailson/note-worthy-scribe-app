CREATE OR REPLACE FUNCTION public.get_nres_practice_colleagues()
RETURNS TABLE(user_id uuid, display_name text, staff_role text, practice_id uuid, practice_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean := v_uid IN (
    'dbefd7c1-47f5-41de-a58e-ab739558af16'::uuid,
    'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid
  );
BEGIN
  RETURN QUERY
  WITH slugify AS (
    SELECT 1
  ),
  user_tokens AS (
    -- practice tokens for any user_id
    SELECT a.user_id, regexp_replace(lower(coalesce(a.practice_key,'')), '[^a-z0-9]', '', 'g') AS tok
      FROM public.nres_buyback_access a WHERE a.practice_key IS NOT NULL
    UNION
    SELECT s.user_id, regexp_replace(lower(coalesce(gp.name,'')), '[^a-z0-9]', '', 'g')
      FROM public.nres_buyback_staff s
      LEFT JOIN public.gp_practices gp ON gp.id = s.practice_id
      WHERE gp.name IS NOT NULL
    UNION
    SELECT pd.user_id, regexp_replace(lower(coalesce(pd.practice_name,'')), '[^a-z0-9]', '', 'g')
      FROM public.practice_details pd WHERE pd.practice_name IS NOT NULL
  ),
  my_tokens AS (
    SELECT DISTINCT tok FROM user_tokens WHERE user_id = v_uid AND tok <> ''
  ),
  candidates AS (
    SELECT DISTINCT u.user_id FROM (
      SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL
      UNION SELECT user_id FROM public.nres_submenu_access WHERE user_id IS NOT NULL
      UNION SELECT user_id FROM public.nres_buyback_access WHERE user_id IS NOT NULL
      UNION SELECT user_id FROM public.nres_buyback_staff WHERE user_id IS NOT NULL
      UNION SELECT user_id FROM public.nres_user_profile WHERE user_id IS NOT NULL
    ) u
    WHERE u.user_id <> v_uid
  ),
  enriched AS (
    SELECT
      c.user_id,
      COALESCE(NULLIF(p.full_name, ''), s.staff_name, NULLIF(p.email, '')) AS display_name,
      s.staff_role,
      s.practice_id,
      COALESCE(gp.name, pd.practice_name) AS practice_name
    FROM candidates c
    LEFT JOIN public.profiles p ON p.user_id = c.user_id
    LEFT JOIN LATERAL (
      SELECT staff_name, staff_role, practice_id
      FROM public.nres_buyback_staff
      WHERE user_id = c.user_id AND COALESCE(is_active, true) = true
      ORDER BY updated_at DESC NULLS LAST LIMIT 1
    ) s ON true
    LEFT JOIN public.gp_practices gp ON gp.id = s.practice_id
    LEFT JOIN LATERAL (
      SELECT practice_name FROM public.practice_details
      WHERE practice_details.user_id = c.user_id
      ORDER BY is_default DESC NULLS LAST, updated_at DESC NULLS LAST LIMIT 1
    ) pd ON true
  )
  SELECT e.user_id, e.display_name, e.staff_role, e.practice_id, e.practice_name
  FROM enriched e
  WHERE e.display_name IS NOT NULL
    AND (
      v_super
      OR EXISTS (
        SELECT 1 FROM user_tokens ut
        JOIN my_tokens mt ON mt.tok <> '' AND ut.tok <> ''
                         AND (ut.tok LIKE '%' || mt.tok || '%' OR mt.tok LIKE '%' || ut.tok || '%')
        WHERE ut.user_id = e.user_id
      )
    )
  ORDER BY display_name NULLS LAST;
END;
$function$;