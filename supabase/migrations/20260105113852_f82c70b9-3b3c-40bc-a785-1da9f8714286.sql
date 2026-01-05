-- Fix function search path security issue
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
$$ LANGUAGE plpgsql SET search_path = public;