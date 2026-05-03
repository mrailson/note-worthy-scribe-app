CREATE OR REPLACE FUNCTION public.get_meeting_full_transcript(p_meeting_id uuid)
 RETURNS TABLE(source text, transcript text, item_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_transcript text;
  v_source text;
  v_count int;
  v_meeting_user_id uuid;
BEGIN
  SELECT user_id INTO v_meeting_user_id
  FROM public.meetings
  WHERE id = p_meeting_id;

  IF v_meeting_user_id IS NULL THEN
    RETURN QUERY SELECT 'error'::text, 'Meeting not found'::text, 0;
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT (
    v_meeting_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.meeting_shares ms
      JOIN auth.users u ON u.id = auth.uid()
      WHERE ms.meeting_id = p_meeting_id
      AND (ms.shared_with_user_id = auth.uid() OR ms.shared_with_email = u.email)
    )
  ) THEN
    RETURN QUERY SELECT 'error'::text, 'Access denied'::text, 0;
    RETURN;
  END IF;

  -- 1) best_of_all_transcript (highest fidelity merged output)
  SELECT best_of_all_transcript, 'best_of_all_transcript', 1
  INTO v_transcript, v_source, v_count
  FROM public.meetings
  WHERE id = p_meeting_id
    AND best_of_all_transcript IS NOT NULL
    AND length(btrim(best_of_all_transcript)) > 0;

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 2) whisper_transcript_text
  SELECT whisper_transcript_text, 'meetings_consolidated', 1
  INTO v_transcript, v_source, v_count
  FROM public.meetings
  WHERE id = p_meeting_id
    AND whisper_transcript_text IS NOT NULL
    AND length(btrim(whisper_transcript_text)) > 0;

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 3) live_transcript_text
  SELECT live_transcript_text, 'live_transcript', 1
  INTO v_transcript, v_source, v_count
  FROM public.meetings
  WHERE id = p_meeting_id
    AND live_transcript_text IS NOT NULL
    AND length(btrim(live_transcript_text)) > 0;

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 4) Latest session in meeting_transcription_chunks
  WITH latest_session AS (
    SELECT mtc2.session_id
    FROM public.meeting_transcription_chunks mtc2
    WHERE mtc2.meeting_id = p_meeting_id
      AND mtc2.user_id = v_meeting_user_id
    GROUP BY mtc2.session_id
    ORDER BY max(mtc2.created_at) DESC, count(*) DESC
    LIMIT 1
  ), rows AS (
    SELECT
      mtc.chunk_number,
      CASE
        WHEN mtc.cleaned_text IS NOT NULL AND mtc.cleaning_status = 'completed' THEN mtc.cleaned_text
        ELSE mtc.transcription_text
      END AS chosen_text,
      public.try_parse_jsonb(mtc.transcription_text) AS parsed_json
    FROM public.meeting_transcription_chunks mtc
    WHERE mtc.meeting_id = p_meeting_id
      AND mtc.user_id = v_meeting_user_id
      AND mtc.session_id = (SELECT session_id FROM latest_session)
  )
  SELECT
    string_agg(
      COALESCE(
        (
          SELECT string_agg(elem->>'text', ' ')
          FROM jsonb_array_elements(
            CASE
              WHEN rows.parsed_json IS NOT NULL AND jsonb_typeof(rows.parsed_json) = 'array' THEN rows.parsed_json
              ELSE '[]'::jsonb
            END
          ) AS elem
        ),
        rows.chosen_text
      ),
      ' '
      ORDER BY rows.chunk_number
    ),
    'meeting_transcription_chunks',
    count(*)::int
  INTO v_transcript, v_source, v_count
  FROM rows;

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 5) meeting_transcripts
  SELECT
    string_agg(mt.content, E'\n\n' ORDER BY mt.created_at),
    'meeting_transcripts',
    count(*)::int
  INTO v_transcript, v_source, v_count
  FROM public.meeting_transcripts mt
  WHERE mt.meeting_id = p_meeting_id
    AND mt.meeting_id IN (SELECT id FROM public.meetings WHERE user_id = v_meeting_user_id);

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 6) Legacy transcription_chunks (correct columns: transcript_text / chunk_number)
  SELECT
    string_agg(tc.transcript_text, E'\n\n' ORDER BY tc.chunk_number),
    'transcription_chunks',
    count(*)::int
  INTO v_transcript, v_source, v_count
  FROM public.transcription_chunks tc
  WHERE tc.meeting_id = p_meeting_id
    AND tc.meeting_id IN (SELECT id FROM public.meetings WHERE user_id = v_meeting_user_id);

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'none'::text, ''::text, 0;
END;
$function$;