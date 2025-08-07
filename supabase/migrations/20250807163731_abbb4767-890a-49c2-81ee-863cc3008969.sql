-- Fix all remaining functions missing search_path security

CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.generate_incident_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  reference TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the next sequence number for this year
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.supplier_incidents
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  reference := 'SI' || year_part || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN reference;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_generate_incident_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.incident_reference IS NULL OR NEW.incident_reference = '' THEN
    NEW.incident_reference = generate_incident_reference();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_combined_transcript(p_meeting_id uuid, p_session_id text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT string_agg(transcription_text, ' ' ORDER BY chunk_number)
  FROM public.meeting_transcription_chunks
  WHERE meeting_id = p_meeting_id 
    AND session_id = p_session_id
    AND user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_meeting_transcript(p_meeting_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT string_agg(transcript_text, ' ' ORDER BY chunk_number)
  FROM public.transcription_chunks
  WHERE meeting_id = p_meeting_id
    AND meeting_id IN (
      SELECT id FROM public.meetings WHERE user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.get_pcn_manager_practice_ids(_user_id uuid DEFAULT auth.uid())
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ARRAY_AGG(practice_id)
  FROM public.pcn_manager_practices
  WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.set_complaint_due_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Set acknowledgement due date (3 working days)
  -- Set response due date (20 working days)
  IF NEW.status = 'submitted' AND (OLD IS NULL OR OLD.status != 'submitted') THEN
    NEW.submitted_at = NOW();
    NEW.response_due_date = NOW() + INTERVAL '20 days';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_generate_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number = generate_complaint_reference();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_pcn_manager_for_practice(_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pcn_manager_practices
    WHERE user_id = _user_id
      AND practice_id = _practice_id
  );
$$;

CREATE OR REPLACE FUNCTION public.log_complaint_action(p_complaint_id uuid, p_action text, p_details jsonb DEFAULT NULL::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.complaint_audit_log (complaint_id, action, details, performed_by)
  VALUES (p_complaint_id, p_action, p_details, auth.uid())
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;