-- Fix the trigger to only calculate word_count WITHOUT modifying transcription_text
CREATE OR REPLACE FUNCTION public.update_chunk_word_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  extracted_text TEXT;
  is_json_format BOOLEAN;
BEGIN
  -- Calculate word count without modifying the original transcription_text
  IF NEW.transcription_text IS NOT NULL AND NEW.transcription_text != '' THEN
    -- Check if it's valid JSON
    BEGIN
      is_json_format := (jsonb_typeof(NEW.transcription_text::jsonb) = 'array');
    EXCEPTION
      WHEN OTHERS THEN
        is_json_format := FALSE;
    END;
    
    -- If it's JSON array format, extract the text for counting only
    IF is_json_format THEN
      BEGIN
        extracted_text := (
          SELECT string_agg(elem->>'text', ' ')
          FROM jsonb_array_elements(NEW.transcription_text::jsonb) AS elem
        );
        
        -- Use extracted text for word count but DON'T modify NEW.transcription_text
        IF extracted_text IS NOT NULL AND extracted_text != '' THEN
          NEW.word_count = COALESCE(
            array_length(
              regexp_split_to_array(
                TRIM(regexp_replace(extracted_text, '\s+', ' ', 'g')),
                '\s+'
              ), 
              1
            ), 0
          );
          RETURN NEW;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- If extraction fails, count from raw text
          NULL;
      END;
    END IF;
  END IF;
  
  -- For plain text or if JSON extraction failed, count from raw text
  NEW.word_count = COALESCE(
    array_length(
      regexp_split_to_array(
        TRIM(regexp_replace(
          COALESCE(NEW.transcription_text, ''), 
          '\s+', ' ', 'g'
        )),
        '\s+'
      ), 
      1
    ), 0
  );
  
  -- Handle empty string case
  IF TRIM(COALESCE(NEW.transcription_text, '')) = '' THEN
    NEW.word_count = 0;
  END IF;
  
  RETURN NEW;
END;
$function$;