-- Fix get_meeting_full_transcript JSON casting errors when transcription_text is plain text

-- 1) Safe JSONB parse helper (returns NULL if input is not valid JSON)
CREATE OR REPLACE FUNCTION public.try_parse_jsonb(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_text::jsonb;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

-- 2) Update transcript selector RPC to use safe parsing (prevents: invalid input syntax for type json)
CREATE OR REPLACE FUNCTION public.get_meeting_full_transcript(p_meeting_id uuid)
RETURNS TABLE(source text, transcript text, item_count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_transcript text;
  v_source text;
  v_count int;
  v_meeting_user_id uuid;
BEGIN
  -- Get the meeting owner's user_id for authorization
  SELECT user_id INTO v_meeting_user_id
  FROM public.meetings
  WHERE id = p_meeting_id;

  -- Check if user has access to this meeting (owner or shared access)
  IF v_meeting_user_id IS NULL THEN
    RETURN QUERY SELECT 'error'::text, 'Meeting not found'::text, 0;
    RETURN;
  END IF;

  -- Only check authorization if we have an authenticated user
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

  -- 1) Check whisper_transcript_text FIRST (better clinical quality from Batch/Whisper)
  SELECT
    whisper_transcript_text AS txt,
    'meetings_consolidated' AS src,
    1 AS cnt
  INTO v_transcript, v_source, v_count
  FROM public.meetings
  WHERE id = p_meeting_id
    AND user_id = v_meeting_user_id
    AND whisper_transcript_text IS NOT NULL
    AND LENGTH(TRIM(whisper_transcript_text)) > 0;

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 2) Check live_transcript_text (fallback to Live/AssemblyAI)
  SELECT
    live_transcript_text AS txt,
    'live_transcript' AS src,
    1 AS cnt
  INTO v_transcript, v_source, v_count
  FROM public.meetings
  WHERE id = p_meeting_id
    AND user_id = v_meeting_user_id
    AND live_transcript_text IS NOT NULL
    AND LENGTH(TRIM(live_transcript_text)) > 0;

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 3) Latest session in meeting_transcription_chunks for this meeting
  -- IMPORTANT: transcription_text is sometimes plain text, sometimes JSON (array of {text,...}).
  -- Use try_parse_jsonb() so plain text never causes a cast error.
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
    ) AS txt,
    'meeting_transcription_chunks' AS src,
    count(*) AS cnt
  INTO v_transcript, v_source, v_count
  FROM rows;

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 4) Concatenated meeting_transcripts (for the meeting owner)
  SELECT
    string_agg(mt.content, E'\n\n' ORDER BY mt.created_at) AS txt,
    'meeting_transcripts' AS src,
    count(*) AS cnt
  INTO v_transcript, v_source, v_count
  FROM public.meeting_transcripts mt
  WHERE mt.meeting_id = p_meeting_id
    AND mt.meeting_id IN (SELECT id FROM public.meetings WHERE user_id = v_meeting_user_id);

  IF v_transcript IS NOT NULL AND length(btrim(v_transcript)) > 0 THEN
    RETURN QUERY SELECT v_source, v_transcript, v_count;
    RETURN;
  END IF;

  -- 5) Legacy transcription_chunks (for the meeting owner)
  SELECT
    string_agg(tc.text, E'\n\n' ORDER BY tc.sequence_number) AS txt,
    'transcription_chunks' AS src,
    count(*) AS cnt
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
$$;