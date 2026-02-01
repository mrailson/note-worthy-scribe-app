-- Drop existing policies
DROP POLICY IF EXISTS "Authorized managers can manage involved parties" ON public.complaint_involved_parties;
DROP POLICY IF EXISTS "complaint_involved_parties_select_restricted" ON public.complaint_involved_parties;

-- Create new SELECT policy with complaints_manager_access support
CREATE POLICY "complaint_involved_parties_select_authorized" 
ON public.complaint_involved_parties 
FOR SELECT USING (
  is_system_admin(auth.uid())
  OR (
    -- Practice managers in same practice
    has_role(auth.uid(), 'practice_manager'::app_role) 
    AND complaint_id IN (
      SELECT c.id FROM complaints c 
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
  )
  OR (
    -- Complaints managers in same practice
    has_role(auth.uid(), 'complaints_manager'::app_role) 
    AND complaint_id IN (
      SELECT c.id FROM complaints c 
      WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
  )
  OR (
    -- Users with complaints_manager_access flag
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
    -- Users who created the complaint
    complaint_id IN (
      SELECT c.id FROM complaints c WHERE c.created_by = auth.uid()
    )
  )
);

-- Create INSERT/UPDATE/DELETE policy
CREATE POLICY "complaint_involved_parties_modify_authorized" 
ON public.complaint_involved_parties 
FOR ALL USING (
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