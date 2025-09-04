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

-- Ensure complaints table exists with proper structure
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_number TEXT UNIQUE,
  patient_name TEXT NOT NULL,
  patient_dob DATE,
  patient_contact_phone TEXT,
  patient_contact_email TEXT,
  patient_address TEXT,
  incident_date DATE,
  complaint_title TEXT NOT NULL,
  complaint_description TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  location_service TEXT,
  staff_mentioned TEXT[],
  status TEXT NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id),
  consent_given BOOLEAN DEFAULT false,
  consent_details TEXT,
  complaint_on_behalf BOOLEAN DEFAULT false,
  complainant_name TEXT,
  complainant_relationship TEXT,
  complainant_contact_phone TEXT,
  complainant_contact_email TEXT,
  practice_id UUID,
  created_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  response_due_date TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for complaints
CREATE POLICY "Users can view complaints for their practice" 
ON public.complaints 
FOR SELECT 
USING (
  practice_id IN (
    SELECT practice_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

CREATE POLICY "Users can create complaints for their practice" 
ON public.complaints 
FOR INSERT 
WITH CHECK (
  practice_id IN (
    SELECT practice_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

CREATE POLICY "Users can update complaints for their practice" 
ON public.complaints 
FOR UPDATE 
USING (
  practice_id IN (
    SELECT practice_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_complaints_reference_number ON public.complaints(reference_number);
CREATE INDEX IF NOT EXISTS idx_complaints_practice_id ON public.complaints(practice_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);

-- Create trigger for updated_at
CREATE TRIGGER update_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for auto-generating reference numbers
CREATE TRIGGER trigger_auto_generate_reference
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_reference();