-- Add RLS policy to allow users to insert into meeting_notes_queue for their own meetings
CREATE POLICY "Users can queue notes for their own meetings" 
ON public.meeting_notes_queue 
FOR INSERT 
WITH CHECK (
  meeting_id IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
  )
);