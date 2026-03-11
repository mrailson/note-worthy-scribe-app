
DROP POLICY "complaints_delete_admins" ON public.complaints;

CREATE POLICY "complaints_delete_authorized"
ON public.complaints FOR DELETE
TO authenticated
USING (
  is_system_admin(auth.uid())
  OR created_by = auth.uid()
  OR (has_role(auth.uid(), 'practice_manager'::app_role) AND practice_id = ANY (get_user_practice_ids(auth.uid())))
  OR (has_role(auth.uid(), 'complaints_manager'::app_role) AND practice_id = ANY (get_user_practice_ids(auth.uid())))
);
