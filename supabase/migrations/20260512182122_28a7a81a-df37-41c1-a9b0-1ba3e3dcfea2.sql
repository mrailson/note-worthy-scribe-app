
DO $$
DECLARE
  v_meeting_id uuid := '41ec0c85-147f-4817-8e36-8ca3068995cb';
  v_user_id    uuid := 'ce00b066-6b57-452e-a5c6-331db6d250dc';
  v_first  timestamptz;
  v_last   timestamptz;
  v_text   text;
  v_words  integer;
  v_chunks integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.meetings WHERE id = v_meeting_id) THEN
    RAISE NOTICE 'Meeting already exists, skipping recovery';
    RETURN;
  END IF;

  SELECT min(created_at), max(created_at), count(*)
    INTO v_first, v_last, v_chunks
  FROM public.meeting_transcription_chunks
  WHERE meeting_id = v_meeting_id;

  SELECT string_agg(seg_text, ' ' ORDER BY chunk_number, seg_idx),
         sum(coalesce(array_length(regexp_split_to_array(trim(seg_text), '\s+'),1),0))
    INTO v_text, v_words
  FROM (
    SELECT mtc.chunk_number, ord.idx AS seg_idx, ord.seg->>'text' AS seg_text
    FROM public.meeting_transcription_chunks mtc,
         jsonb_array_elements(mtc.transcription_text::jsonb) WITH ORDINALITY ord(seg, idx)
    WHERE mtc.meeting_id = v_meeting_id
  ) s;

  INSERT INTO public.meetings (
    id, user_id, title, status, notes_generation_status,
    start_time, end_time, duration_minutes, chunk_count, word_count,
    whisper_transcript_text, best_of_all_transcript, primary_transcript_source,
    meeting_type, format, created_at, updated_at
  ) VALUES (
    v_meeting_id, v_user_id,
    'PCN Board Meeting — 12 May 2026 (recovered)',
    'completed', 'queued',
    v_first, v_last,
    GREATEST(1, ceil(extract(epoch FROM (v_last - v_first))/60.0))::int,
    v_chunks, v_words,
    v_text, v_text, 'whisper',
    'standard', 'in_person',
    v_first, now()
  );

  RAISE NOTICE 'Recovered meeting % with % chunks, % words', v_meeting_id, v_chunks, v_words;
END $$;
