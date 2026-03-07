
CREATE OR REPLACE FUNCTION public.is_practice_manager_for_practice(_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'practice_manager'
      AND (
        -- Direct match (if practice_id is a gp_practices id)
        ur.practice_id = _practice_id
        OR
        -- Match via practice_details -> gp_practices name lookup
        ur.practice_id IN (
          SELECT gp.id
          FROM public.gp_practices gp
          INNER JOIN public.practice_details pd ON (
            LOWER(REPLACE(gp.name, 'The ', '')) = LOWER(REPLACE(pd.practice_name, 'The ', ''))
            OR LOWER(gp.name) = LOWER(pd.practice_name)
          )
          WHERE pd.id = _practice_id
        )
      )
  )
$$;
