CREATE OR REPLACE FUNCTION public.nres_user_practice_keys(_uid uuid)
RETURNS TABLE(practice_key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH access_keys AS (
    SELECT DISTINCT public.nres_normalise_practice_key(a.practice_key) AS key_value
    FROM public.nres_buyback_access a
    WHERE a.user_id = _uid
      AND public.nres_normalise_practice_key(a.practice_key) IS NOT NULL
  ),
  raw_keys AS (
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

    UNION

    SELECT ak.key_value
    FROM access_keys ak
    WHERE (SELECT count(*) FROM access_keys) = 1
  )
  SELECT DISTINCT rk.key_value AS practice_key
  FROM raw_keys rk
  WHERE rk.key_value IS NOT NULL AND rk.key_value <> '';
$$;

GRANT EXECUTE ON FUNCTION public.nres_user_practice_keys(uuid) TO authenticated;