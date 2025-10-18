-- Fix RLS policy for complaint_outcome_questionnaires to allow users with complaint access
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Authorized users can create questionnaires" ON public.complaint_outcome_questionnaires;

-- Create new policy that allows users who can view the complaint to create questionnaires
CREATE POLICY "Users can create questionnaires for accessible complaints"
ON public.complaint_outcome_questionnaires
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by 
  AND complaint_id IN (
    SELECT c.id 
    FROM complaints c 
    WHERE (
      c.practice_id = ANY (get_user_practice_ids(auth.uid())) 
      OR c.created_by = auth.uid()
    )
  )
);