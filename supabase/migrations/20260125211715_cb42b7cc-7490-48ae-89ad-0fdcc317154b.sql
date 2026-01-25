-- Add DELETE policy for reception translation sessions
-- Users should be able to delete their own translation sessions

CREATE POLICY "Users can delete their own sessions"
ON public.reception_translation_sessions
FOR DELETE
USING (auth.uid() = user_id);