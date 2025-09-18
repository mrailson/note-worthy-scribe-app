-- Add DELETE policy for live_meeting_notes table
CREATE POLICY "Users can delete their own live meeting notes" 
ON public.live_meeting_notes 
FOR DELETE 
USING (user_id = auth.uid());