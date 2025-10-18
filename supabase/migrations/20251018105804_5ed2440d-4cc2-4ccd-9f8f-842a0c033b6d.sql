-- Allow authorised users to update complaints (e.g., trigger updating status on outcome insert)
-- Safe to run multiple times: drop existing similarly-named policy if present
DROP POLICY IF EXISTS "Managers can update their practice complaints" ON public.complaints;

CREATE POLICY "Managers can update their practice complaints"
ON public.complaints
FOR UPDATE
TO authenticated
USING (
  -- who can target existing rows to update
  is_system_admin(auth.uid())
  OR has_role(auth.uid(), 'practice_manager'::app_role)
  OR has_role(auth.uid(), 'complaints_manager'::app_role)
  OR created_by = auth.uid()
  OR practice_id = ANY (get_user_practice_ids(auth.uid()))
)
WITH CHECK (
  -- ensure updated row is still within the same access boundary
  is_system_admin(auth.uid())
  OR has_role(auth.uid(), 'practice_manager'::app_role)
  OR has_role(auth.uid(), 'complaints_manager'::app_role)
  OR created_by = auth.uid()
  OR practice_id = ANY (get_user_practice_ids(auth.uid()))
);
