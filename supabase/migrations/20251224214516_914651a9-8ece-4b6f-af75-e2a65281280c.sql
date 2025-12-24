-- Expand practice manager lookup to include PCN managers
CREATE OR REPLACE FUNCTION public.get_practice_manager_practice_id(_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT practice_id
  FROM public.user_roles
  WHERE user_id = _user_id
    AND practice_id IS NOT NULL
    AND role IN ('practice_manager'::public.app_role, 'pcn_manager'::public.app_role)
  ORDER BY CASE
    WHEN role = 'practice_manager'::public.app_role THEN 1
    WHEN role = 'pcn_manager'::public.app_role THEN 2
    ELSE 3
  END
  LIMIT 1;
$$;

-- Allow organisation admins to edit their own organisation record (gp_practices)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gp_practices'
      AND policyname = 'Org admins can update assigned gp practices'
  ) THEN
    CREATE POLICY "Org admins can update assigned gp practices"
    ON public.gp_practices
    FOR UPDATE
    TO authenticated
    USING (
      id IN (
        SELECT ur.practice_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.practice_id IS NOT NULL
          AND ur.role IN ('practice_manager'::public.app_role, 'pcn_manager'::public.app_role)
      )
    )
    WITH CHECK (
      id IN (
        SELECT ur.practice_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.practice_id IS NOT NULL
          AND ur.role IN ('practice_manager'::public.app_role, 'pcn_manager'::public.app_role)
      )
    );
  END IF;
END$$;