CREATE OR REPLACE FUNCTION public.has_can_view_narp_identifiable(_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_system_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND can_view_narp_identifiable = true
        AND (practice_id = _practice_id OR practice_id IS NULL)
    );
$$;

CREATE OR REPLACE FUNCTION public.has_can_export_narp_identifiable(_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_system_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND can_export_narp_identifiable = true
        AND (practice_id = _practice_id OR practice_id IS NULL)
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_can_view_narp_identifiable(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_can_export_narp_identifiable(uuid, uuid) TO authenticated;