
-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Allow transcription chunk inserts for valid meetings" ON public.meeting_transcription_chunks;

-- Create a simpler, more permissive INSERT policy
-- Allow inserts if the chunk's user_id matches a valid meeting's user_id
CREATE POLICY "Allow transcription chunk inserts for valid meetings" 
ON public.meeting_transcription_chunks
FOR INSERT
TO public
WITH CHECK (
  -- Allow if authenticated user matches the user_id
  (auth.uid() = user_id)
  OR
  -- Allow if the meeting exists and belongs to the user_id on the chunk
  (
    EXISTS (
      SELECT 1 FROM public.meetings m 
      WHERE m.id = meeting_transcription_chunks.meeting_id 
        AND m.user_id = meeting_transcription_chunks.user_id
    )
  )
);
