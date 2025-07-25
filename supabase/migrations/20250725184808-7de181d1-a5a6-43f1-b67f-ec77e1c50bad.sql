-- Update complaint reference generation to use CP prefix
CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  reference TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the next sequence number for this year
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.complaints
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  reference := 'CP' || year_part || LPAD(sequence_num::TEXT, 5, '0');
  
  RETURN reference;
END;
$function$;

-- Create complaint acknowledgements table
CREATE TABLE public.complaint_acknowledgements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  acknowledgement_letter TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create complaint involved parties table
CREATE TABLE public.complaint_involved_parties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  staff_email TEXT NOT NULL,
  staff_role TEXT,
  response_requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  response_submitted_at TIMESTAMP WITH TIME ZONE,
  response_text TEXT,
  access_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create complaint outcomes table
CREATE TABLE public.complaint_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('rejected', 'upheld', 'partially_upheld')),
  outcome_summary TEXT NOT NULL,
  outcome_letter TEXT NOT NULL,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.complaint_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_involved_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_outcomes ENABLE ROW LEVEL SECURITY;

-- RLS policies for acknowledgements
CREATE POLICY "Users can view acknowledgements for their practice complaints"
ON public.complaint_acknowledgements
FOR SELECT
USING (
  is_system_admin() OR 
  (complaint_id IN (
    SELECT c.id FROM complaints c 
    WHERE (c.practice_id IN (
      SELECT ur.practice_id FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    ) OR c.created_by = auth.uid())
  ))
);

CREATE POLICY "Authenticated users can create acknowledgements"
ON public.complaint_acknowledgements
FOR INSERT
WITH CHECK (auth.uid() = sent_by);

-- RLS policies for involved parties
CREATE POLICY "Users can view involved parties for their practice complaints"
ON public.complaint_involved_parties
FOR SELECT
USING (
  is_system_admin() OR 
  (complaint_id IN (
    SELECT c.id FROM complaints c 
    WHERE (c.practice_id IN (
      SELECT ur.practice_id FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    ) OR c.created_by = auth.uid())
  ))
);

CREATE POLICY "Authenticated users can manage involved parties"
ON public.complaint_involved_parties
FOR ALL
USING (
  is_system_admin() OR 
  (complaint_id IN (
    SELECT c.id FROM complaints c 
    WHERE (c.practice_id IN (
      SELECT ur.practice_id FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    ) OR c.created_by = auth.uid())
  ))
);

-- RLS policies for outcomes
CREATE POLICY "Users can view outcomes for their practice complaints"
ON public.complaint_outcomes
FOR SELECT
USING (
  is_system_admin() OR 
  (complaint_id IN (
    SELECT c.id FROM complaints c 
    WHERE (c.practice_id IN (
      SELECT ur.practice_id FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    ) OR c.created_by = auth.uid())
  ))
);

CREATE POLICY "Practice managers can create outcomes"
ON public.complaint_outcomes
FOR INSERT
WITH CHECK (
  is_system_admin() OR 
  has_role(auth.uid(), 'practice_manager'::app_role) OR
  has_role(auth.uid(), 'complaints_manager'::app_role)
);

-- Function to get complaint details for external access (without patient identifiable info)
CREATE OR REPLACE FUNCTION public.get_complaint_for_external_access(access_token_param UUID)
RETURNS TABLE (
  complaint_id UUID,
  reference_number TEXT,
  complaint_title TEXT,
  complaint_description TEXT,
  category complaint_category,
  incident_date DATE,
  location_service TEXT,
  staff_name TEXT,
  staff_email TEXT,
  staff_role TEXT,
  response_text TEXT,
  response_submitted BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT 
    c.id as complaint_id,
    c.reference_number,
    c.complaint_title,
    c.complaint_description,
    c.category,
    c.incident_date,
    c.location_service,
    cip.staff_name,
    cip.staff_email,
    cip.staff_role,
    cip.response_text,
    (cip.response_submitted_at IS NOT NULL) as response_submitted
  FROM public.complaints c
  JOIN public.complaint_involved_parties cip ON c.id = cip.complaint_id
  WHERE cip.access_token = access_token_param;
$function$;

-- Function to submit external response
CREATE OR REPLACE FUNCTION public.submit_external_response(
  access_token_param UUID,
  response_text_param TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.complaint_involved_parties
  SET 
    response_text = response_text_param,
    response_submitted_at = now()
  WHERE access_token = access_token_param;
  
  RETURN FOUND;
END;
$function$;