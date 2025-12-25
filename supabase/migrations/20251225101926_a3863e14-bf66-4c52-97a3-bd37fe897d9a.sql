-- Fix practice_details RLS so organisation members can see shared details
-- (previous policies incorrectly compared practice_details.id to user_roles.practice_id)

BEGIN;

DROP POLICY IF EXISTS "Users can view practice details they own or are assigned to" ON public.practice_details;
DROP POLICY IF EXISTS "Users can update practice details they own or are assigned to" ON public.practice_details;

-- Allow org members to read the practice_details row that matches their assigned gp_practices.name
CREATE POLICY "Org members can view practice details"
ON public.practice_details
FOR SELECT
TO authenticated
USING (
  is_system_admin()
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.gp_practices gp ON gp.id = ur.practice_id
    WHERE ur.user_id = auth.uid()
      AND ur.practice_id IS NOT NULL
      AND lower(gp.name) = lower(practice_details.practice_name)
  )
);

-- Allow org admins to update shared practice_details for their organisation
CREATE POLICY "Org admins can update practice details"
ON public.practice_details
FOR UPDATE
TO authenticated
USING (
  is_system_admin()
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.gp_practices gp ON gp.id = ur.practice_id
    WHERE ur.user_id = auth.uid()
      AND ur.practice_id IS NOT NULL
      AND ur.role = ANY (
        ARRAY[
          'practice_manager'::public.app_role,
          'pcn_manager'::public.app_role,
          'administrator'::public.app_role
        ]
      )
      AND lower(gp.name) = lower(practice_details.practice_name)
  )
)
WITH CHECK (
  is_system_admin()
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.gp_practices gp ON gp.id = ur.practice_id
    WHERE ur.user_id = auth.uid()
      AND ur.practice_id IS NOT NULL
      AND ur.role = ANY (
        ARRAY[
          'practice_manager'::public.app_role,
          'pcn_manager'::public.app_role,
          'administrator'::public.app_role
        ]
      )
      AND lower(gp.name) = lower(practice_details.practice_name)
  )
);

COMMIT;
