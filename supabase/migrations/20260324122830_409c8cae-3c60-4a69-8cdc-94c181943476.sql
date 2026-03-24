
CREATE TABLE IF NOT EXISTS public.meeting_transcription_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  transcript_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, chunk_index)
);

ALTER TABLE public.meeting_transcription_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on meeting_transcription_chunks"
  ON public.meeting_transcription_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own meeting transcription chunks"
  ON public.meeting_transcription_chunks
  FOR SELECT
  TO authenticated
  USING (
    meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid())
  );
