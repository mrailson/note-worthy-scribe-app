-- Fix acknowledgements SELECT policy to include system admins
DROP POLICY IF EXISTS "Users can view acknowledgements for their practice complaints" ON public.complaint_acknowledgements;

CREATE POLICY "Users can view acknowledgements for accessible complaints"
ON public.complaint_acknowledgements
FOR SELECT
TO authenticated
USING (
  -- System admins can view all
  is_system_admin(auth.uid())
  -- Practice managers can view for their practices
  OR has_role(auth.uid(), 'practice_manager'::app_role)
  -- Complaints managers can view for their practices  
  OR has_role(auth.uid(), 'complaints_manager'::app_role)
  -- Users can view for complaints in their practice or that they created
  OR complaint_id IN (
    SELECT c.id
    FROM complaints c
    WHERE (c.practice_id = ANY (get_user_practice_ids(auth.uid())) OR c.created_by = auth.uid())
  )
);