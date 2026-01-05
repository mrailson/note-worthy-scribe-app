-- Add DELETE policy for complaint_investigation_transcripts
CREATE POLICY "Users can delete their own investigation transcripts" 
ON public.complaint_investigation_transcripts 
FOR DELETE 
USING (
  (auth.uid() = transcribed_by) 
  OR (complaint_id IN (
    SELECT c.id FROM complaints c 
    WHERE c.created_by = auth.uid() 
    OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    OR is_system_admin(auth.uid())
  ))
);