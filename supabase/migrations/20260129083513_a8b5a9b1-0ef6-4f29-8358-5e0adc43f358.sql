-- Add short_code column to ai_chat_capture_sessions
ALTER TABLE public.ai_chat_capture_sessions 
ADD COLUMN short_code text UNIQUE;

-- Create function to generate short code for capture sessions
CREATE OR REPLACE FUNCTION public.generate_ai_chat_capture_short_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    -- Generate a 6-character alphanumeric code
    new_code := upper(substring(encode(gen_random_bytes(4), 'base64') from 1 for 6));
    -- Replace any non-alphanumeric characters
    new_code := regexp_replace(new_code, '[^A-Z0-9]', substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' from (floor(random() * 32) + 1)::int for 1), 'g');
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.ai_chat_capture_sessions WHERE short_code = new_code) INTO code_exists;
    
    IF NOT code_exists THEN
      NEW.short_code := new_code;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate short_code on insert
CREATE TRIGGER generate_short_code_trigger
BEFORE INSERT ON public.ai_chat_capture_sessions
FOR EACH ROW
WHEN (NEW.short_code IS NULL)
EXECUTE FUNCTION public.generate_ai_chat_capture_short_code();

-- Backfill existing sessions with short codes (if any)
UPDATE public.ai_chat_capture_sessions 
SET short_code = upper(substring(encode(gen_random_bytes(4), 'base64') from 1 for 6))
WHERE short_code IS NULL;

-- Create index for fast lookups
CREATE INDEX idx_ai_chat_capture_sessions_short_code ON public.ai_chat_capture_sessions(short_code);