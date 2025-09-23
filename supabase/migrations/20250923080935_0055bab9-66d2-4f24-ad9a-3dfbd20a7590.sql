-- Fix the function dependency issue by properly handling triggers

-- Drop the triggers first
DROP TRIGGER IF EXISTS update_chunk_word_count_trigger ON public.meeting_transcription_chunks;
DROP TRIGGER IF EXISTS trigger_update_chunk_word_count ON public.meeting_transcription_chunks;

-- Now drop and recreate the function with proper search path
DROP FUNCTION IF EXISTS public.update_chunk_word_count() CASCADE;

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

-- Recreate the trigger
CREATE TRIGGER update_chunk_word_count_trigger
BEFORE INSERT OR UPDATE OF transcription_text ON public.meeting_transcription_chunks
FOR EACH ROW
EXECUTE FUNCTION public.update_chunk_word_count();