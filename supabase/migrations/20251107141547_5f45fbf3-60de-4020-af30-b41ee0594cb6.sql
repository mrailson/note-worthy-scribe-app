-- Fix RLS policy to allow admins and practice managers to view all questionnaires
DROP POLICY IF EXISTS "Users can view questionnaires for their practice complaints" ON complaint_outcome_questionnaires;

CREATE POLICY "Users can view questionnaires for their practice complaints"
ON complaint_outcome_questionnaires
FOR SELECT
TO public
USING (
  -- System admins can view all questionnaires
  is_system_admin(auth.uid())
  OR
  -- Practice managers can view all questionnaires
  has_role(auth.uid(), 'practice_manager'::app_role)
  OR
  -- Complaints managers can view all questionnaires
  has_role(auth.uid(), 'complaints_manager'::app_role)
  OR
  -- Users can view questionnaires for complaints they have access to
  complaint_id IN (
    SELECT c.id
    FROM complaints c
    WHERE (c.practice_id = ANY (get_user_practice_ids(auth.uid())) 
      OR c.created_by = auth.uid())
  )
);