-- Fix RLS for practice_staff_defaults so access checks align with practice_details IDs
-- Existing policies incorrectly compare practice_details IDs to gp_practices IDs.

DROP POLICY IF EXISTS "Users can view staff defaults for their practices" ON public.practice_staff_defaults;
DROP POLICY IF EXISTS "Practice managers can manage staff defaults" ON public.practice_staff_defaults;

CREATE POLICY "Users can view staff defaults for their practice details"
ON public.practice_staff_defaults
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.practice_details pd
    WHERE pd.id = practice_staff_defaults.practice_id
      AND (
        pd.user_id = auth.uid()
        OR (
          pd.ods_code IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.gp_practices gp ON gp.id = ur.practice_id
            WHERE ur.user_id = auth.uid()
              AND gp.practice_code = pd.ods_code
          )
        )
      )
  )
);

CREATE POLICY "Practice managers can manage staff defaults"
ON public.practice_staff_defaults
FOR ALL
TO authenticated
USING (
  (
    has_role(auth.uid(), 'practice_manager'::app_role)
    OR has_role(auth.uid(), 'system_admin'::app_role)
    OR has_role(auth.uid(), 'complaints_manager'::app_role)
  )
  AND EXISTS (
    SELECT 1
    FROM public.practice_details pd
    WHERE pd.id = practice_staff_defaults.practice_id
      AND (
        pd.user_id = auth.uid()
        OR (
          pd.ods_code IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.gp_practices gp ON gp.id = ur.practice_id
            WHERE ur.user_id = auth.uid()
              AND gp.practice_code = pd.ods_code
          )
        )
      )
  )
)
WITH CHECK (
  (
    has_role(auth.uid(), 'practice_manager'::app_role)
    OR has_role(auth.uid(), 'system_admin'::app_role)
    OR has_role(auth.uid(), 'complaints_manager'::app_role)
  )
  AND EXISTS (
    SELECT 1
    FROM public.practice_details pd
    WHERE pd.id = practice_staff_defaults.practice_id
      AND (
        pd.user_id = auth.uid()
        OR (
          pd.ods_code IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.gp_practices gp ON gp.id = ur.practice_id
            WHERE ur.user_id = auth.uid()
              AND gp.practice_code = pd.ods_code
          )
        )
      )
  )
);