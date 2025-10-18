-- Fix RLS so audit entries are written and visible
-- complaint_audit_detailed: relax INSERT and broaden SELECT to include sysadmins and accessible complaints
DROP POLICY IF EXISTS "System can insert detailed audit logs" ON public.complaint_audit_detailed;
DROP POLICY IF EXISTS "Users can view audit logs for their practice complaints" ON public.complaint_audit_detailed;

-- Allow any authenticated user to insert audit logs for actions they perform on accessible complaints
CREATE POLICY "Users can insert audit logs for accessible complaints"
ON public.complaint_audit_detailed
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    is_system_admin(auth.uid())
    OR has_role(auth.uid(), 'practice_manager'::app_role)
    OR has_role(auth.uid(), 'complaints_manager'::app_role)
    OR complaint_id IN (
      SELECT c.id FROM complaints c
      WHERE (c.practice_id = ANY (get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid())
    )
  )
);

-- Allow authorised users to view audit logs (sysadmin, managers, or accessible complaints)
CREATE POLICY "Users can view audit logs for accessible complaints"
ON public.complaint_audit_detailed
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid())
  OR has_role(auth.uid(), 'practice_manager'::app_role)
  OR has_role(auth.uid(), 'complaints_manager'::app_role)
  OR complaint_id IN (
    SELECT c.id FROM complaints c
    WHERE (c.practice_id = ANY (get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid())
  )
);
