
-- Returns the best available full transcript for a meeting, with source and item count
-- Order of preference:
--   1) Latest session in meeting_transcription_chunks (chunked, ordered by chunk_number)
--   2) Concatenated meeting_transcripts rows
--   3) Legacy transcription_chunks
CREATE OR REPLACE FUNCTION public.get_meeting_full_transcript(p_meeting_id uuid)
RETURNS TABLE(source text, transcript text, item_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_transcript text;
  v_source text;
  v_count int;
BEGIN
  -- 1) Latest session in meeting_transcription_chunks for this user and meeting
  SELECT
    string_agg(mtc.transcription_text, ' ' ORDER BY mtc.chunk_number) AS txt,
    'meeting_transcription_chunks' AS src,
    count(*) AS cnt
  INTO v_transcript, v_source, v_count
  FROM public.meeting_transcription_chunks mtc
  WHERE mtc.meeting_id = p_meeting_id
    AND mtc.user_id = auth.uid()
    AND mtc.session_id = (
      SELECT mtc2.session_id
      FROM public.meeting_transcription_chunks mtc2
      WHERE mtc2.meeting_id = p_meeting_id
        AND mtc2.user_id = auth.uid()
      GROUP BY mtc2.session_id
      ORDER BY max(mtc2.created_at) DESC, count(*) DESC
      LIMIT 1
    );

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 2) Concatenated meeting_transcripts (enforcing user-owned meeting)
  SELECT
    string_agg(mt.content, E'\n\n' ORDER BY mt.created_at) AS txt,
    'meeting_transcripts' AS src,
    count(*) AS cnt
  INTO v_transcript, v_source, v_count
  FROM public.meeting_transcripts mt
  WHERE mt.meeting_id = p_meeting_id
    AND mt.meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid());

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 3) Legacy transcription_chunks (enforcing user-owned meeting)
  SELECT
    string_agg(tc.transcript_text, ' ' ORDER BY tc.chunk_number) AS txt,
    'transcription_chunks' AS src,
    count(*) AS cnt
  INTO v_transcript, v_source, v_count
  FROM public.transcription_chunks tc
  WHERE tc.meeting_id = p_meeting_id
    AND tc.meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid());

  RETURN QUERY SELECT v_source, COALESCE(v_transcript, ''), COALESCE(v_count, 0);
END;
$$;
