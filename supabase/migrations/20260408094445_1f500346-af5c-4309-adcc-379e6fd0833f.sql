
DROP POLICY IF EXISTS "Users can view staff responses for complaints they have access to" ON public.staff_responses;

CREATE POLICY "Users can view staff responses for complaints they have access to"
  ON public.staff_responses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = staff_responses.complaint_id
      AND (
        is_system_admin(auth.uid())
        OR c.practice_id = get_practice_manager_practice_id(auth.uid())
        OR c.practice_id = ANY(get_pcn_manager_practice_ids(auth.uid()))
        OR c.created_by = auth.uid()
      )
    )
  );
