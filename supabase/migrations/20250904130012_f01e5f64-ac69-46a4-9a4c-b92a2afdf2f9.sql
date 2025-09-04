-- Fix CQC evidence visibility by updating RLS policies
-- Allow users to see evidence they uploaded, even if practice_id is null
DROP POLICY IF EXISTS "Users can view evidence for their practices" ON cqc_evidence;

CREATE POLICY "Users can view evidence for their practices or uploaded by them" 
ON cqc_evidence 
FOR SELECT 
USING (
  -- User has access to the practice
  (practice_id = ANY (get_user_practice_ids())) 
  OR 
  -- User uploaded the evidence (even if practice_id is null)
  (uploaded_by = auth.uid())
  OR
  -- User is system admin
  (is_system_admin(auth.uid()))
);

-- Also update the management policy to handle null practice_id
DROP POLICY IF EXISTS "Practice managers can manage evidence" ON cqc_evidence;

CREATE POLICY "Practice managers can manage evidence" 
ON cqc_evidence 
FOR ALL 
USING (
  -- User has access to the practice AND has the right role
  ((practice_id = ANY (get_user_practice_ids())) AND (has_role(auth.uid(), 'practice_manager'::app_role) OR has_role(auth.uid(), 'system_admin'::app_role)))
  OR
  -- User uploaded the evidence (for personal/unassigned evidence)
  (uploaded_by = auth.uid())
  OR
  -- System admin can manage all
  (is_system_admin(auth.uid()))
) 
WITH CHECK (
  -- Same conditions for inserts/updates
  ((practice_id = ANY (get_user_practice_ids())) AND (has_role(auth.uid(), 'practice_manager'::app_role) OR has_role(auth.uid(), 'system_admin'::app_role)))
  OR
  (uploaded_by = auth.uid())
  OR
  (is_system_admin(auth.uid()))
);