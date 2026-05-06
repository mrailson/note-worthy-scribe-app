
DROP FUNCTION IF EXISTS public.get_todays_meetings_details();

CREATE OR REPLACE FUNCTION public.get_todays_meetings_details()
 RETURNS TABLE(
   id uuid,
   user_id uuid,
   title text,
   start_time timestamp with time zone,
   end_time timestamp with time zone,
   duration_minutes integer,
   word_count integer,
   import_source text,
   device_browser text,
   device_type text,
   primary_transcript_source text,
   assembly_words integer,
   whisper_words integer,
   live_words integer,
   best_of_all_words integer
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.user_id,
    m.title,
    COALESCE(m.start_time, m.created_at) as start_time,
    COALESCE(m.end_time, m.updated_at) as end_time,
    m.duration_minutes,
    COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0) as word_count,
    m.import_source,
    m.device_browser,
    m.device_type,
    m.primary_transcript_source,
    CASE WHEN COALESCE(m.assembly_transcript_text, m.assembly_ai_transcript, '') = '' THEN 0
         ELSE array_length(regexp_split_to_array(btrim(COALESCE(m.assembly_transcript_text, m.assembly_ai_transcript)), '\s+'), 1) END as assembly_words,
    CASE WHEN COALESCE(m.whisper_transcript_text, '') = '' THEN 0
         ELSE array_length(regexp_split_to_array(btrim(m.whisper_transcript_text), '\s+'), 1) END as whisper_words,
    CASE WHEN COALESCE(m.live_transcript_text, '') = '' THEN 0
         ELSE array_length(regexp_split_to_array(btrim(m.live_transcript_text), '\s+'), 1) END as live_words,
    CASE WHEN COALESCE(m.best_of_all_transcript, '') = '' THEN 0
         ELSE array_length(regexp_split_to_array(btrim(m.best_of_all_transcript), '\s+'), 1) END as best_of_all_words
  FROM public.meetings m
  WHERE m.status = 'completed'
    AND m.created_at::date = CURRENT_DATE
    AND COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0) >= 100
  ORDER BY COALESCE(m.start_time, m.created_at) DESC;
END;
$function$;
