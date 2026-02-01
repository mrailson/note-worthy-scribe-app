-- Fix RLS policies for complaint_involved_parties - add TO authenticated
DROP POLICY IF EXISTS "complaint_involved_parties_select_authorized" ON public.complaint_involved_parties;
DROP POLICY IF EXISTS "complaint_involved_parties_modify_authorized" ON public.complaint_involved_parties;

-- Create SELECT policy with TO authenticated
CREATE POLICY "complaint_involved_parties_select_authorized" 
ON public.complaint_involved_parties 
FOR SELECT 
TO authenticated
USING (
  is_system_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'practice_manager'::app_role) 
    AND complaint_id IN (
      SELECT c.id FROM complaints c 
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
  )
  OR (
    has_role(auth.uid(), 'complaints_manager'::app_role) 
    AND complaint_id IN (
      SELECT c.id FROM complaints c 
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
  )
  OR (
    complaint_id IN (
      SELECT c.id FROM complaints c 
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.complaints_manager_access = true
    )
  )
  OR (
    complaint_id IN (
      SELECT c.id FROM complaints c WHERE c.created_by = auth.uid()
    )
  )
);

-- Create INSERT/UPDATE/DELETE policy with TO authenticated
CREATE POLICY "complaint_involved_parties_modify_authorized" 
ON public.complaint_involved_parties 
FOR ALL 
TO authenticated
USING (
  is_system_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'practice_manager'::app_role) 
    AND complaint_id IN (
      SELECT c.id FROM complaints c 
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
  )
  OR (
    has_role(auth.uid(), 'complaints_manager'::app_role) 
    AND complaint_id IN (
      SELECT c.id FROM complaints c 
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
  )
  OR (
    complaint_id IN (
      SELECT c.id FROM complaints c 
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.complaints_manager_access = true
    )
  )
)
WITH CHECK (
  is_system_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'practice_manager'::app_role) 
    AND complaint_id IN (
      SELECT c.id FROM complaints c 
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
  )
  OR (
    has_role(auth.uid(), 'complaints_manager'::app_role) 
    AND complaint_id IN (
      SELECT c.id FROM complaints c 
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
  )
  OR (
    complaint_id IN (
      SELECT c.id FROM complaints c 
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.complaints_manager_access = true
    )
  )
);