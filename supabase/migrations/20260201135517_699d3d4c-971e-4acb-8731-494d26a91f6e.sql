-- Update RLS policy to also check complaints_manager_access flag
DROP POLICY IF EXISTS "complaints_select_authorized_only" ON public.complaints;

CREATE POLICY "complaints_select_authorized_only"
ON public.complaints
FOR SELECT
USING (
  is_system_admin(auth.uid()) 
  OR (created_by = auth.uid())
  OR (
    (practice_id = ANY (get_user_practice_ids(auth.uid()))) 
    AND has_role(auth.uid(), 'practice_manager'::app_role)
  )
  OR (
    (practice_id = ANY (get_user_practice_ids(auth.uid()))) 
    AND has_role(auth.uid(), 'complaints_manager'::app_role)
  )
  OR (
    (practice_id = ANY (get_user_practice_ids(auth.uid()))) 
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.complaints_manager_access = true
    )
  )
);