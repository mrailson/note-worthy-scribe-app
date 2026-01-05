-- Add reference_number column to board actions
ALTER TABLE public.nres_board_actions 
ADD COLUMN IF NOT EXISTS reference_number TEXT;

-- Create a function to generate unique reference numbers (BA-YYYY-NNNN format)
CREATE OR REPLACE FUNCTION generate_board_action_reference()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  new_ref TEXT;
BEGIN
  year_part := to_char(CURRENT_DATE, 'YYYY');
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(reference_number, '^BA-' || year_part || '-', ''), '') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM public.nres_board_actions
  WHERE reference_number LIKE 'BA-' || year_part || '-%';
  
  -- Format as BA-YYYY-NNNN
  new_ref := 'BA-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  
  NEW.reference_number := new_ref;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate reference on insert
DROP TRIGGER IF EXISTS set_board_action_reference ON public.nres_board_actions;
CREATE TRIGGER set_board_action_reference
  BEFORE INSERT ON public.nres_board_actions
  FOR EACH ROW
  WHEN (NEW.reference_number IS NULL)
  EXECUTE FUNCTION generate_board_action_reference();

-- Update existing records with reference numbers
DO $$
DECLARE
  rec RECORD;
  year_part TEXT;
  seq_num INTEGER := 0;
  last_year TEXT := '';
BEGIN
  FOR rec IN 
    SELECT id, created_at 
    FROM public.nres_board_actions 
    WHERE reference_number IS NULL
    ORDER BY created_at ASC
  LOOP
    year_part := to_char(rec.created_at::DATE, 'YYYY');
    
    IF year_part != last_year THEN
      -- Reset sequence for new year
      SELECT COALESCE(MAX(
        CAST(NULLIF(regexp_replace(reference_number, '^BA-' || year_part || '-', ''), '') AS INTEGER)
      ), 0)
      INTO seq_num
      FROM public.nres_board_actions
      WHERE reference_number LIKE 'BA-' || year_part || '-%';
      last_year := year_part;
    END IF;
    
    seq_num := seq_num + 1;
    
    UPDATE public.nres_board_actions
    SET reference_number = 'BA-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0')
    WHERE id = rec.id;
  END LOOP;
END $$;