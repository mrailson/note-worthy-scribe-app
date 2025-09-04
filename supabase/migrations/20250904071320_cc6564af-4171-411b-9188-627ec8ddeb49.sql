-- Create the missing generate_complaint_reference function
CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  ref_number TEXT;
  year_suffix TEXT;
  sequence_num INTEGER;
BEGIN
  -- Get the current year suffix (last 2 digits)
  year_suffix := EXTRACT(YEAR FROM NOW())::TEXT;
  year_suffix := RIGHT(year_suffix, 2);
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN reference_number ~ ('^COMP' || year_suffix || '[0-9]+$') 
      THEN SUBSTRING(reference_number FROM length('COMP' || year_suffix) + 1)::INTEGER
      ELSE 0 
    END
  ), 0) + 1
  INTO sequence_num
  FROM public.complaints
  WHERE reference_number LIKE 'COMP' || year_suffix || '%';
  
  -- Format the reference number: COMP + YY + 4-digit sequence
  ref_number := 'COMP' || year_suffix || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN ref_number;
END;
$$;