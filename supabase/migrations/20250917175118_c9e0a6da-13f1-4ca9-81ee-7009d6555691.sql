-- Continue fixing remaining functions with explicit search_path

-- 12) get_user_modules
CREATE OR REPLACE FUNCTION public.get_user_modules(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(module app_module, granted_at timestamp with time zone, granted_by uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT um.module, um.granted_at, um.granted_by
  FROM public.user_modules um
  WHERE um.user_id = p_user_id
    AND um.enabled = true
  ORDER BY um.granted_at DESC;
$function$;

-- 13) get_user_practice_ids
CREATE OR REPLACE FUNCTION public.get_user_practice_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT ARRAY_AGG(DISTINCT practice_id)
  FROM public.user_roles
  WHERE user_id = p_user_id
    AND practice_id IS NOT NULL;
$function$;

-- 14) get_current_user_role
CREATE OR REPLACE FUNCTION public.get_current_user_role(check_user_id uuid DEFAULT auth.uid())
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT role FROM public.user_roles 
  WHERE user_id = check_user_id 
  AND role = 'system_admin'
  LIMIT 1;
$function$;

-- 15) has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- 16) generate_complaint_reference
CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

-- 17) generate_incident_reference
CREATE OR REPLACE FUNCTION public.generate_incident_reference()
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
  FROM public.supplier_incidents
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  reference := 'SI' || year_part || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN reference;
END;
$function$;

-- 18) validate_nhs_email
CREATE OR REPLACE FUNCTION public.validate_nhs_email(email_address text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN email_address ~* '^[^@]+@(nhs\.net|nhs\.uk|nhft\.nhs\.uk)$';
END;
$function$;

-- 19) get_practice_manager_assignable_roles
CREATE OR REPLACE FUNCTION public.get_practice_manager_assignable_roles()
RETURNS app_role[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT ARRAY['user']::app_role[];
$function$;

-- 20) initialize_complaint_compliance
CREATE OR REPLACE FUNCTION public.initialize_complaint_compliance(complaint_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Insert all required NHS compliance items
  INSERT INTO public.complaint_compliance_checks (complaint_id, compliance_item, is_compliant, evidence, notes)
  VALUES 
    (complaint_id_param, 'Acknowledgement sent within 3 working days', false, NULL, 'NHS England requirement - Local Authority Social Services and NHS Complaints Regulations 2009'),
    (complaint_id_param, 'Investigation completed within 20 working days', false, NULL, 'NHS Constitution pledge - may be extended with good reason'),
    (complaint_id_param, 'Patient consent obtained (if complaint made on behalf)', false, NULL, 'Data Protection Act 2018 and GDPR compliance'),
    (complaint_id_param, 'All relevant staff notified and responses collected', false, NULL, 'Duty of candour and thorough investigation requirement'),
    (complaint_id_param, 'Clinical governance team involved (if clinical complaint)', false, NULL, 'CQC Regulation 20 - Duty of candour'),
    (complaint_id_param, 'Patient safety incident reported (if applicable)', false, NULL, 'NHS Patient Safety Strategy 2019'),
    (complaint_id_param, 'Learning and improvement actions identified', false, NULL, 'CQC Key Lines of Enquiry - Learning from complaints'),
    (complaint_id_param, 'Response letter includes escalation routes', false, NULL, 'NHS England complaints procedure - PHSO information'),
    (complaint_id_param, 'Complaint logged in practice register', false, NULL, 'CQC Regulation 16 - Receiving and acting on complaints'),
    (complaint_id_param, 'Senior management oversight documented', false, NULL, 'Good governance and accountability'),
    (complaint_id_param, 'Confidentiality maintained throughout process', false, NULL, 'Patient confidentiality and GDPR compliance'),
    (complaint_id_param, 'Fair and thorough investigation conducted', false, NULL, 'NHS Constitution - Right to have complaint investigated'),
    (complaint_id_param, 'Response addresses all points raised', false, NULL, 'Good complaints handling - comprehensive response'),
    (complaint_id_param, 'Apologetic tone where appropriate', false, NULL, 'Duty of candour and professional standards'),
    (complaint_id_param, 'Quality improvement actions implemented', false, NULL, 'CQC Well-led domain - Learning and improvement');
END;
$function$;

-- 21) get_complaint_compliance_summary
CREATE OR REPLACE FUNCTION public.get_complaint_compliance_summary(complaint_id_param uuid)
RETURNS TABLE(total_items integer, compliant_items integer, compliance_percentage numeric, outstanding_items text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT 
    COUNT(*)::INTEGER as total_items,
    SUM(CASE WHEN is_compliant THEN 1 ELSE 0 END)::INTEGER as compliant_items,
    ROUND((SUM(CASE WHEN is_compliant THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)) * 100, 1) as compliance_percentage,
    ARRAY_AGG(compliance_item) FILTER (WHERE NOT is_compliant) as outstanding_items
  FROM public.complaint_compliance_checks
  WHERE complaint_id = complaint_id_param;
$function$;

-- 22) get_complaint_for_external_access
CREATE OR REPLACE FUNCTION public.get_complaint_for_external_access(access_token_param uuid)
RETURNS TABLE(complaint_id uuid, reference_number text, complaint_title text, complaint_description text, category complaint_category, incident_date date, location_service text, staff_name text, staff_email text, staff_role text, response_text text, response_submitted boolean)
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
  WHERE cip.access_token = access_token_param
    AND (cip.access_token_expires_at IS NULL OR cip.access_token_expires_at > now());
$function$;

-- 23) submit_external_response
CREATE OR REPLACE FUNCTION public.submit_external_response(access_token_param uuid, response_text_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.complaint_involved_parties
  SET 
    response_text = response_text_param,
    response_submitted_at = now(),
    access_token_last_used_at = now()
  WHERE access_token = access_token_param
    AND (access_token_expires_at IS NULL OR access_token_expires_at > now());
  
  RETURN FOUND;
END;
$function$;