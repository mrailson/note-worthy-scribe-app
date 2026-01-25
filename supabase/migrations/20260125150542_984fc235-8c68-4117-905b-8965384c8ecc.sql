-- Add short_code column for shorter survey URLs
ALTER TABLE public.surveys 
ADD COLUMN short_code TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX idx_surveys_short_code ON public.surveys(short_code);

-- Function to generate random short codes
CREATE OR REPLACE FUNCTION generate_short_code(length INTEGER DEFAULT 6)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to generate unique short code for surveys
CREATE OR REPLACE FUNCTION generate_unique_survey_short_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Only generate if short_code is null
  IF NEW.short_code IS NULL THEN
    LOOP
      new_code := generate_short_code(6);
      SELECT EXISTS(SELECT 1 FROM public.surveys WHERE short_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.short_code := new_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-generate short codes on insert
CREATE TRIGGER surveys_generate_short_code
  BEFORE INSERT ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION generate_unique_survey_short_code();

-- Generate short codes for existing surveys
UPDATE public.surveys 
SET short_code = generate_short_code(6) 
WHERE short_code IS NULL;

-- Ensure uniqueness by regenerating any duplicates
DO $$
DECLARE
  dup RECORD;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  FOR dup IN 
    SELECT id FROM public.surveys 
    WHERE short_code IN (
      SELECT short_code FROM public.surveys 
      GROUP BY short_code HAVING COUNT(*) > 1
    )
  LOOP
    LOOP
      new_code := generate_short_code(6);
      SELECT EXISTS(SELECT 1 FROM public.surveys WHERE short_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    UPDATE public.surveys SET short_code = new_code WHERE id = dup.id;
  END LOOP;
END $$;

-- Now make short_code NOT NULL
ALTER TABLE public.surveys ALTER COLUMN short_code SET NOT NULL;