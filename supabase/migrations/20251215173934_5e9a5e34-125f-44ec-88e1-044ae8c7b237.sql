-- Drop the overly permissive policy that allows all practice users to manage all attendees
DROP POLICY IF EXISTS "Practice users can manage attendees" ON public.attendees;

-- Create separate policies for proper access control

-- Users can SELECT their own attendees OR practice managers can see practice attendees
CREATE POLICY "attendees_select_own_or_practice_manager" 
ON public.attendees 
FOR SELECT 
USING (
  -- User can see their own attendees
  user_id = auth.uid()
  OR
  -- Practice managers can see attendees for their practice
  (
    practice_id = ANY (get_user_practice_ids(auth.uid()))
    AND has_role(auth.uid(), 'practice_manager'::app_role)
  )
);

-- Users can UPDATE their own attendees OR practice managers can update practice attendees
CREATE POLICY "attendees_update_own_or_practice_manager" 
ON public.attendees 
FOR UPDATE 
USING (
  user_id = auth.uid()
  OR
  (
    practice_id = ANY (get_user_practice_ids(auth.uid()))
    AND has_role(auth.uid(), 'practice_manager'::app_role)
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR
  (
    practice_id = ANY (get_user_practice_ids(auth.uid()))
    AND has_role(auth.uid(), 'practice_manager'::app_role)
  )
);

-- Users can DELETE their own attendees OR practice managers can delete practice attendees
CREATE POLICY "attendees_delete_own_or_practice_manager" 
ON public.attendees 
FOR DELETE 
USING (
  user_id = auth.uid()
  OR
  (
    practice_id = ANY (get_user_practice_ids(auth.uid()))
    AND has_role(auth.uid(), 'practice_manager'::app_role)
  )
);