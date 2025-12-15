-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authorized users can view complaints" ON public.complaints;

-- Create a more restrictive SELECT policy
-- Only complaint creator, complaints managers, practice managers, or system admins can view
CREATE POLICY "complaints_select_authorized_only" 
ON public.complaints 
FOR SELECT 
USING (
  -- System admins can see all
  is_system_admin(auth.uid())
  OR
  -- User created the complaint
  created_by = auth.uid()
  OR
  -- Practice managers can see complaints in their practice
  (
    practice_id = ANY (get_user_practice_ids(auth.uid()))
    AND has_role(auth.uid(), 'practice_manager'::app_role)
  )
  OR
  -- Complaints managers can see complaints in their practice
  (
    practice_id = ANY (get_user_practice_ids(auth.uid()))
    AND has_role(auth.uid(), 'complaints_manager'::app_role)
  )
);

-- Also fix the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Managers can update their practice complaints" ON public.complaints;