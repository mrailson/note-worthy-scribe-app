-- Fix the last 3 functions with mutable search_path by dropping and recreating them

-- 1. Fix auto_update_complaint_status (trigger function)
DROP FUNCTION IF EXISTS public.auto_update_complaint_status() CASCADE;

CREATE OR REPLACE FUNCTION public.auto_update_complaint_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- If closed_at is being set and status is not 'closed', update it
  IF NEW.closed_at IS NOT NULL AND NEW.status != 'closed' THEN
    NEW.status = 'closed';
  END IF;
  
  -- If closed_at is being cleared, ensure status is not 'closed'
  IF NEW.closed_at IS NULL AND NEW.status = 'closed' THEN
    NEW.status = 'under_review';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Fix cleanup_meeting_note_versions (trigger function)
DROP FUNCTION IF EXISTS public.cleanup_meeting_note_versions() CASCADE;

CREATE OR REPLACE FUNCTION public.cleanup_meeting_note_versions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Only cleanup if meeting status changed to 'completed'
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    -- Delete all versions for this meeting
    DELETE FROM public.live_meeting_notes_versions 
    WHERE meeting_id = NEW.id;
    
    -- Log the cleanup
    INSERT INTO public.system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      new_values
    ) VALUES (
      'live_meeting_notes_versions',
      'CLEANUP_ON_COMPLETION',
      NEW.id,
      NEW.user_id,
      jsonb_build_object('meeting_id', NEW.id, 'cleanup_reason', 'meeting_completed')
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. Fix safe_extract_word_count (immutable function)
DROP FUNCTION IF EXISTS public.safe_extract_word_count(text) CASCADE;

CREATE OR REPLACE FUNCTION public.safe_extract_word_count(p_text text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
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

-- Recreate any triggers that were dropped
-- Auto update complaint status trigger
DROP TRIGGER IF EXISTS auto_update_complaint_status_trigger ON complaints;
CREATE TRIGGER auto_update_complaint_status_trigger
  BEFORE UPDATE ON complaints
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_complaint_status();

-- Cleanup meeting notes versions trigger
DROP TRIGGER IF EXISTS cleanup_meeting_notes_on_completion ON meetings;
CREATE TRIGGER cleanup_meeting_notes_on_completion
  AFTER UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_meeting_note_versions();

COMMENT ON FUNCTION public.auto_update_complaint_status() IS 'Trigger function to automatically update complaint status based on closed_at field - search_path secured';
COMMENT ON FUNCTION public.cleanup_meeting_note_versions() IS 'Trigger function to cleanup meeting note versions when meeting is completed - search_path secured';
COMMENT ON FUNCTION public.safe_extract_word_count(text) IS 'Safely counts words in text or JSON array - immutable with search_path secured';