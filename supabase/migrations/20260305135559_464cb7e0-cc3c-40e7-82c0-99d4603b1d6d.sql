-- Fix SELECT policy: use flexible name matching (strip "The " prefix)
DROP POLICY "Org members can view practice details" ON public.practice_details;

CREATE POLICY "Org members can view practice details"
ON public.practice_details FOR SELECT TO authenticated
USING (
  is_system_admin()
  OR (user_id = auth.uid())
  OR (EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN gp_practices gp ON gp.id = ur.practice_id
    WHERE ur.user_id = auth.uid()
      AND ur.practice_id IS NOT NULL
      AND lower(regexp_replace(gp.name, '^[Tt]he\s+', ''))
        = lower(regexp_replace(practice_details.practice_name, '^[Tt]he\s+', ''))
  ))
);

-- Fix UPDATE policy: same flexible name matching
DROP POLICY "Org admins can update practice details" ON public.practice_details;

CREATE POLICY "Org admins can update practice details"
ON public.practice_details FOR UPDATE TO authenticated
USING (
  is_system_admin()
  OR (user_id = auth.uid())
  OR (EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN gp_practices gp ON gp.id = ur.practice_id
    WHERE ur.user_id = auth.uid()
      AND ur.practice_id IS NOT NULL
      AND ur.role = ANY (ARRAY['practice_manager'::app_role, 'pcn_manager'::app_role, 'administrator'::app_role])
      AND lower(regexp_replace(gp.name, '^[Tt]he\s+', ''))
        = lower(regexp_replace(practice_details.practice_name, '^[Tt]he\s+', ''))
  ))
);