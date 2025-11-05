-- First, just update the trigger function for future chunks
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
  -- Extract text from JSON array format if present
  IF NEW.transcription_text IS NOT NULL AND NEW.transcription_text != '' THEN
    -- Check if it's valid JSON
    BEGIN
      is_json_format := (jsonb_typeof(NEW.transcription_text::jsonb) = 'array');
    EXCEPTION
      WHEN OTHERS THEN
        is_json_format := FALSE;
    END;
    
    -- If it's JSON array format, extract the text
    IF is_json_format THEN
      BEGIN
        extracted_text := (
          SELECT string_agg(elem->>'text', ' ')
          FROM jsonb_array_elements(NEW.transcription_text::jsonb) AS elem
        );
        
        -- Replace the JSON with extracted text for easier processing
        IF extracted_text IS NOT NULL AND extracted_text != '' THEN
          NEW.transcription_text := extracted_text;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- Keep original text if extraction fails
          NULL;
      END;
    END IF;
  END IF;
  
  -- Calculate word count from the text
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

-- Create a helper function to safely extract text and count words
CREATE OR REPLACE FUNCTION public.safe_extract_word_count(p_text TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  extracted_text TEXT;
  is_valid_json BOOLEAN;
BEGIN
  -- Try to parse as JSON and extract text
  BEGIN
    is_valid_json := (jsonb_typeof(p_text::jsonb) = 'array');
    
    IF is_valid_json THEN
      extracted_text := (
        SELECT string_agg(elem->>'text', ' ')
        FROM jsonb_array_elements(p_text::jsonb) AS elem
      );
      
      IF extracted_text IS NOT NULL AND extracted_text != '' THEN
        -- Count words in extracted text
        RETURN COALESCE(
          array_length(
            regexp_split_to_array(
              TRIM(regexp_replace(extracted_text, '\s+', ' ', 'g')),
              '\s+'
            ),
            1
          ), 0
        );
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Not valid JSON, treat as plain text
      NULL;
  END;
  
  -- Count words in plain text
  RETURN COALESCE(
    array_length(
      regexp_split_to_array(
        TRIM(regexp_replace(COALESCE(p_text, ''), '\s+', ' ', 'g')),
        '\s+'
      ),
      1
    ), 0
  );
END;
$function$;

-- Now update chunks in batches using the safe function
UPDATE meeting_transcription_chunks
SET word_count = public.safe_extract_word_count(transcription_text)
WHERE transcription_text IS NOT NULL
  AND transcription_text != '';