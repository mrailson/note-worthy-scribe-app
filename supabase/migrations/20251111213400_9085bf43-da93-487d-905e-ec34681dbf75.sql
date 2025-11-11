-- Drop existing restrictive INSERT policy on attendees if it exists
DROP POLICY IF EXISTS "Users can insert attendees for their practices" ON public.attendees;

-- Create new INSERT policy that allows users to add attendees of ANY organization type
-- as long as the attendee is linked to a practice the user has access to
CREATE POLICY "Users can insert attendees for their practices" ON public.attendees
FOR INSERT
TO authenticated
WITH CHECK (
  practice_id IN (
    SELECT practice_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);