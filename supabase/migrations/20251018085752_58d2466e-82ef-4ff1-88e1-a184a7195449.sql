-- Broaden INSERT policy to include admins/managers and practice access
DROP POLICY IF EXISTS "Users can create questionnaires for accessible complaints" ON public.complaint_outcome_questionnaires;

CREATE POLICY "Authorized users can create questionnaires"
ON public.complaint_outcome_questionnaires
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by AND (
    is_system_admin(auth.uid())
    OR has_role(auth.uid(), 'practice_manager'::app_role)
    OR has_role(auth.uid(), 'complaints_manager'::app_role)
    OR complaint_id IN (
      SELECT c.id FROM complaints c
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
         OR c.created_by = auth.uid()
    )
  )
);