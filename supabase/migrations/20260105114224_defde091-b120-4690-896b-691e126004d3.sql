-- Update the function to use NMP prefix instead of BA
CREATE OR REPLACE FUNCTION generate_board_action_reference()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  new_ref TEXT;
BEGIN
  year_part := to_char(CURRENT_DATE, 'YYYY');
  
  -- Get the next sequence number for this year (check both old BA- and new NMP- prefixes)
  SELECT COALESCE(MAX(
    GREATEST(
      COALESCE(CAST(NULLIF(regexp_replace(reference_number, '^NMP-' || year_part || '-', ''), reference_number) AS INTEGER), 0),
      COALESCE(CAST(NULLIF(regexp_replace(reference_number, '^BA-' || year_part || '-', ''), reference_number) AS INTEGER), 0)
    )
  ), 0) + 1
  INTO seq_num
  FROM public.nres_board_actions
  WHERE reference_number LIKE 'NMP-' || year_part || '-%'
     OR reference_number LIKE 'BA-' || year_part || '-%';
  
  -- Format as NMP-YYYY-NNNN
  new_ref := 'NMP-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  
  NEW.reference_number := new_ref;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Update existing BA- references to NMP-
UPDATE public.nres_board_actions
SET reference_number = REPLACE(reference_number, 'BA-', 'NMP-')
WHERE reference_number LIKE 'BA-%';