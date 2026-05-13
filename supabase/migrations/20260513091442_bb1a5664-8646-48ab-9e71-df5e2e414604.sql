CREATE OR REPLACE FUNCTION public.nres_normalise_practice_key(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH n AS (
    SELECT regexp_replace(lower(coalesce(_value, '')), '[^a-z0-9]', '', 'g') AS v
  )
  SELECT CASE
    WHEN v = '' THEN NULL
    WHEN v IN ('bugbrooke', 'bugbrookemedicalpractice', 'k83070') THEN 'bugbrooke'
    WHEN v IN ('brook', 'brookmedicalcentre', 'k83048') THEN 'brook'
    WHEN v IN ('brackley', 'brackleymedicalcentre', 'k83049') THEN 'brackley'
    WHEN v IN ('denton', 'dentonsurgery', 'dentonvillagesurgery', 'k83068') THEN 'denton'
    WHEN v IN ('parks', 'theparks', 'theparksmedicalpractice', 'k83052') THEN 'parks'
    WHEN v IN ('springfield', 'springfieldsurgery', 'k83018') THEN 'springfield'
    WHEN v IN ('towcester', 'towcestermedicalcentre', 'k83022') THEN 'towcester'
    WHEN v IN ('btpcn', 'bt_pcn', 'brackleytowcesterpcn', 'brackleyandtowcesterpcn') THEN 'bt_pcn'
    ELSE v
  END
  FROM n;
$$;

CREATE OR REPLACE FUNCTION public.nres_user_practice_keys(_uid uuid)
RETURNS TABLE(practice_key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH raw_keys AS (
    SELECT public.nres_normalise_practice_key(a.practice_key) AS key_value
    FROM public.nres_buyback_access a
    WHERE a.user_id = _uid

    UNION

    SELECT public.nres_normalise_practice_key(s.practice_key) AS key_value
    FROM public.nres_buyback_staff s
    WHERE s.user_id = _uid

    UNION

    SELECT public.nres_normalise_practice_key(gp.name) AS key_value
    FROM public.nres_buyback_staff s
    JOIN public.gp_practices gp ON gp.id = s.practice_id
    WHERE s.user_id = _uid

    UNION

    SELECT public.nres_normalise_practice_key(gp.practice_code) AS key_value
    FROM public.nres_buyback_staff s
    JOIN public.gp_practices gp ON gp.id = s.practice_id
    WHERE s.user_id = _uid

    UNION

    SELECT public.nres_normalise_practice_key(pd.practice_name) AS key_value
    FROM public.practice_details pd
    WHERE pd.user_id = _uid

    UNION

    SELECT public.nres_normalise_practice_key(pd.ods_code) AS key_value
    FROM public.practice_details pd
    WHERE pd.user_id = _uid
  )
  SELECT DISTINCT rk.key_value AS practice_key
  FROM raw_keys rk
  WHERE rk.key_value IS NOT NULL AND rk.key_value <> '';
$$;

CREATE OR REPLACE FUNCTION public.nres_users_share_practice(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    _a = _b
    OR _a IN (
      'dbefd7c1-47f5-41de-a58e-ab739558af16'::uuid,
      'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid
    )
    OR public.is_nres_verifier(_a)
    OR EXISTS (
      SELECT 1
      FROM public.nres_user_practice_keys(_a) ak
      JOIN public.nres_user_practice_keys(_b) bk ON bk.practice_key = ak.practice_key
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_nres_practice_colleagues()
RETURNS TABLE(user_id uuid, display_name text, staff_role text, practice_id uuid, practice_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller_ctx AS (
    SELECT
      auth.uid() AS uid,
      (
        auth.uid() IN (
          'dbefd7c1-47f5-41de-a58e-ab739558af16'::uuid,
          'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid
        )
        OR public.is_nres_verifier(auth.uid())
      ) AS can_see_all
  ),
  candidate_ids AS (
    SELECT DISTINCT src.candidate_user_id
    FROM (
      SELECT p.user_id AS candidate_user_id FROM public.profiles p WHERE p.user_id IS NOT NULL
      UNION
      SELECT a.user_id AS candidate_user_id FROM public.nres_buyback_access a WHERE a.user_id IS NOT NULL
      UNION
      SELECT s.user_id AS candidate_user_id FROM public.nres_buyback_staff s WHERE s.user_id IS NOT NULL
      UNION
      SELECT pd.user_id AS candidate_user_id FROM public.practice_details pd WHERE pd.user_id IS NOT NULL
      UNION
      SELECT up.user_id AS candidate_user_id FROM public.nres_user_profile up WHERE up.user_id IS NOT NULL
    ) src
    CROSS JOIN caller_ctx cc
    WHERE src.candidate_user_id <> cc.uid
      AND EXISTS (
        SELECT 1 FROM public.profiles prof WHERE prof.user_id = src.candidate_user_id
      )
      AND EXISTS (
        SELECT 1 FROM public.nres_user_practice_keys(src.candidate_user_id) ck
      )
      AND (
        cc.can_see_all
        OR EXISTS (
          SELECT 1
          FROM public.nres_user_practice_keys(cc.uid) my_key
          JOIN public.nres_user_practice_keys(src.candidate_user_id) their_key
            ON their_key.practice_key = my_key.practice_key
        )
      )
  ),
  enriched AS (
    SELECT
      ci.candidate_user_id,
      COALESCE(NULLIF(p.full_name, ''), NULLIF(p.email, ''), latest_staff.staff_name) AS resolved_display_name,
      latest_staff.staff_role AS resolved_staff_role,
      COALESCE(latest_staff.practice_id, matched_practice.id) AS resolved_practice_id,
      COALESCE(staff_gp.name, matched_practice.name, pd.practice_name) AS resolved_practice_name
    FROM candidate_ids ci
    LEFT JOIN public.profiles p ON p.user_id = ci.candidate_user_id
    LEFT JOIN LATERAL (
      SELECT s.staff_name, s.staff_role, s.practice_id, s.practice_key
      FROM public.nres_buyback_staff s
      WHERE s.user_id = ci.candidate_user_id
        AND COALESCE(s.is_active, true) = true
      ORDER BY s.updated_at DESC NULLS LAST
      LIMIT 1
    ) latest_staff ON true
    LEFT JOIN public.gp_practices staff_gp ON staff_gp.id = latest_staff.practice_id
    LEFT JOIN LATERAL (
      SELECT pd_inner.practice_name, pd_inner.ods_code
      FROM public.practice_details pd_inner
      WHERE pd_inner.user_id = ci.candidate_user_id
      ORDER BY pd_inner.is_default DESC NULLS LAST, pd_inner.updated_at DESC NULLS LAST
      LIMIT 1
    ) pd ON true
    LEFT JOIN LATERAL (
      SELECT gp.id, gp.name
      FROM public.gp_practices gp
      WHERE public.nres_normalise_practice_key(gp.name) = COALESCE(
              public.nres_normalise_practice_key(latest_staff.practice_key),
              public.nres_normalise_practice_key(pd.practice_name)
            )
         OR public.nres_normalise_practice_key(gp.practice_code) = public.nres_normalise_practice_key(pd.ods_code)
      ORDER BY gp.name
      LIMIT 1
    ) matched_practice ON true
  )
  SELECT
    e.candidate_user_id AS user_id,
    e.resolved_display_name AS display_name,
    e.resolved_staff_role AS staff_role,
    e.resolved_practice_id AS practice_id,
    e.resolved_practice_name AS practice_name
  FROM enriched e
  WHERE e.resolved_display_name IS NOT NULL
  ORDER BY e.resolved_display_name NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.nres_normalise_practice_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nres_user_practice_keys(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nres_users_share_practice(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nres_practice_colleagues() TO authenticated;