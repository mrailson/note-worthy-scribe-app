CREATE OR REPLACE FUNCTION public.get_nres_practice_colleagues()
RETURNS TABLE(user_id uuid, display_name text, staff_role text, practice_id uuid, practice_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT auth.uid() AS uid,
           auth.uid() IN (
             'dbefd7c1-47f5-41de-a58e-ab739558af16'::uuid, -- Amanda Palin
             'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid  -- Malcolm Railson
           ) AS is_super
  ),
  my_practice_ids AS (
    SELECT DISTINCT practice_id FROM public.nres_buyback_staff
    WHERE user_id = (SELECT uid FROM me) AND practice_id IS NOT NULL
  ),
  my_practice_names AS (
    SELECT DISTINCT lower(trim(practice_name)) AS name FROM public.practice_details
    WHERE user_id = (SELECT uid FROM me) AND practice_name IS NOT NULL
    UNION
    SELECT DISTINCT lower(trim(gp.name)) FROM public.gp_practices gp
    JOIN my_practice_ids mp ON mp.practice_id = gp.id
  ),
  candidates AS (
    SELECT DISTINCT u.user_id FROM (
      SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL
      UNION
      SELECT user_id FROM public.nres_submenu_access WHERE user_id IS NOT NULL
      UNION
      SELECT user_id FROM public.nres_buyback_access WHERE user_id IS NOT NULL
      UNION
      SELECT user_id FROM public.nres_buyback_staff WHERE user_id IS NOT NULL
      UNION
      SELECT user_id FROM public.nres_user_profile WHERE user_id IS NOT NULL
    ) u
    WHERE u.user_id <> (SELECT uid FROM me)
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
      (SELECT is_super FROM me)
      OR e.practice_id IN (SELECT practice_id FROM my_practice_ids)
      OR lower(trim(e.practice_name)) IN (SELECT name FROM my_practice_names)
    )
  ORDER BY display_name NULLS LAST;
$function$;