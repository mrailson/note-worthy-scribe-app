-- Fix RLS policy for meeting_transcription_chunks to allow user to insert their own data
-- even if the meeting record hasn't been fully created yet

DROP POLICY IF EXISTS "Users can insert transcription chunks for accessible meetings" ON public.meeting_transcription_chunks;

CREATE POLICY "Users can insert transcription chunks for accessible meetings" 
ON public.meeting_transcription_chunks 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND (
    meeting_id IS NULL OR 
    user_has_meeting_access(meeting_id, auth.uid()) OR
    -- Allow if user owns a meeting with this ID (even if not fully set up)
    EXISTS (SELECT 1 FROM public.meetings WHERE id = meeting_id AND user_id = auth.uid())
  )
);