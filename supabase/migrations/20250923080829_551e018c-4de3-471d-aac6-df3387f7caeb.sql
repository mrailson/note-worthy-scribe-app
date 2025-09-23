-- Fix security warnings: Set proper search paths for functions

-- Fix find_chunks_needing_realtime_cleaning function
DROP FUNCTION IF EXISTS public.find_chunks_needing_realtime_cleaning(INTEGER);
CREATE OR REPLACE FUNCTION public.find_chunks_needing_realtime_cleaning(batch_size INTEGER DEFAULT 5)
RETURNS TABLE(
  chunk_id UUID,
  meeting_id UUID,
  transcription_text TEXT,
  word_count INTEGER,
  chunk_number INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mtc.id as chunk_id,
    mtc.meeting_id,
    mtc.transcription_text,
    mtc.word_count,
    mtc.chunk_number
  FROM public.meeting_transcription_chunks mtc
  INNER JOIN public.meetings m ON mtc.meeting_id = m.id
  WHERE 
    mtc.cleaning_status = 'pending'
    AND mtc.word_count >= 20  -- Only process chunks with sufficient content
    AND LENGTH(TRIM(COALESCE(mtc.transcription_text, ''))) > 50
    AND mtc.created_at >= NOW() - INTERVAL '24 hours'  -- Focus on recent chunks
    AND mtc.id NOT IN (
      SELECT tcj.chunk_id 
      FROM public.transcript_cleaning_jobs tcj 
      WHERE tcj.chunk_id = mtc.id 
      AND tcj.processing_status IN ('processing', 'pending')
    )
  ORDER BY 
    -- Prioritize active meetings
    CASE WHEN m.status = 'recording' THEN 1 ELSE 2 END,
    mtc.created_at DESC
  LIMIT batch_size;
END;
$$;

-- Fix update_chunk_cleaning_stats function  
DROP FUNCTION IF EXISTS public.update_chunk_cleaning_stats(INTEGER, BOOLEAN, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.update_chunk_cleaning_stats(
  p_chunks_processed INTEGER DEFAULT 1,
  p_is_realtime BOOLEAN DEFAULT TRUE,
  p_processing_time_ms INTEGER DEFAULT 0,
  p_failed_count INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  today_date DATE;
  avg_time_ms INTEGER;
BEGIN
  today_date := CURRENT_DATE;
  
  -- Calculate average processing time
  SELECT 
    CASE 
      WHEN p_chunks_processed > 0 THEN p_processing_time_ms / p_chunks_processed
      ELSE 0
    END
  INTO avg_time_ms;
  
  -- Insert or update daily stats
  INSERT INTO public.chunk_cleaning_stats (
    date,
    total_chunks_processed,
    realtime_chunks_processed,
    background_chunks_processed,
    failed_chunks,
    average_cleaning_time_ms,
    total_processing_time_ms
  ) VALUES (
    today_date,
    p_chunks_processed,
    CASE WHEN p_is_realtime THEN p_chunks_processed ELSE 0 END,
    CASE WHEN NOT p_is_realtime THEN p_chunks_processed ELSE 0 END,
    p_failed_count,
    avg_time_ms,
    p_processing_time_ms
  )
  ON CONFLICT (date) 
  DO UPDATE SET
    total_chunks_processed = chunk_cleaning_stats.total_chunks_processed + EXCLUDED.total_chunks_processed,
    realtime_chunks_processed = chunk_cleaning_stats.realtime_chunks_processed + EXCLUDED.realtime_chunks_processed,
    background_chunks_processed = chunk_cleaning_stats.background_chunks_processed + EXCLUDED.background_chunks_processed,
    failed_chunks = chunk_cleaning_stats.failed_chunks + EXCLUDED.failed_chunks,
    total_processing_time_ms = chunk_cleaning_stats.total_processing_time_ms + EXCLUDED.total_processing_time_ms,
    average_cleaning_time_ms = 
      CASE 
        WHEN (chunk_cleaning_stats.total_chunks_processed + EXCLUDED.total_chunks_processed) > 0 
        THEN (chunk_cleaning_stats.total_processing_time_ms + EXCLUDED.total_processing_time_ms)::INTEGER / 
             (chunk_cleaning_stats.total_chunks_processed + EXCLUDED.total_chunks_processed)
        ELSE 0
      END,
    updated_at = now();
END;
$$;

-- Fix update_chunk_word_count function
DROP FUNCTION IF EXISTS public.update_chunk_word_count();
CREATE OR REPLACE FUNCTION public.update_chunk_word_count()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Calculate word count from transcription_text
  NEW.word_count = COALESCE(
    array_length(
      string_to_array(
        regexp_replace(
          COALESCE(NEW.transcription_text, ''), 
          '[^\w\s]', ' ', 'g'
        ), 
        ' '
      ), 
      1
    ), 0
  );
  
  RETURN NEW;
END;
$$;