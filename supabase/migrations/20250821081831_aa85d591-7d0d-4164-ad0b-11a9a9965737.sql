-- Fix RLS policies for meeting_transcription_chunks to allow server-side inserts

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert transcription chunks for accessible meetings" ON public.meeting_transcription_chunks;
DROP POLICY IF EXISTS "Users can update their own transcription chunks for accessible " ON public.meeting_transcription_chunks;
DROP POLICY IF EXISTS "Users can view transcription chunks for accessible meetings" ON public.meeting_transcription_chunks;

-- Create updated policies that allow server-side operations
CREATE POLICY "Allow transcription chunk inserts for valid meetings"
ON public.meeting_transcription_chunks
FOR INSERT
WITH CHECK (
  -- Allow if authenticated user matches user_id
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR
  -- Allow server-side inserts if meeting exists and user_id matches meeting owner
  (auth.uid() IS NULL AND EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_id AND m.user_id = meeting_transcription_chunks.user_id
  ))
);

CREATE POLICY "Allow transcription chunk updates for accessible meetings"
ON public.meeting_transcription_chunks
FOR UPDATE
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id AND 
   ((meeting_id IS NULL) OR user_has_meeting_access(meeting_id, auth.uid())))
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id AND 
   ((meeting_id IS NULL) OR user_has_meeting_access(meeting_id, auth.uid())))
);

CREATE POLICY "Allow transcription chunk access for meeting participants"
ON public.meeting_transcription_chunks
FOR SELECT
USING (
  -- Authenticated users can view their own chunks or chunks from accessible meetings
  (auth.uid() IS NOT NULL AND 
   ((auth.uid() = user_id) OR 
    ((meeting_id IS NOT NULL) AND user_has_meeting_access(meeting_id, auth.uid()))))
  OR
  -- Allow server-side reads for valid meetings
  (auth.uid() IS NULL AND meeting_id IS NOT NULL)
);