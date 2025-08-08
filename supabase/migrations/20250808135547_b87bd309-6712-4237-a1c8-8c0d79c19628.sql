-- Fix all remaining functions with mutable search paths
-- Update all security definer functions to have secure search paths

CREATE OR REPLACE FUNCTION public.is_practice_manager_for_practice(_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'practice_manager'
      AND practice_id = _practice_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_practice_manager_practice_id(_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT practice_id
  FROM public.user_roles
  WHERE user_id = _user_id
    AND role = 'practice_manager'
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.is_pcn_manager(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'pcn_manager'
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_complaint_for_external_access(access_token_param uuid)
RETURNS TABLE(complaint_id uuid, reference_number text, complaint_title text, complaint_description text, category complaint_category, incident_date date, location_service text, staff_name text, staff_email text, staff_role text, response_text text, response_submitted boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
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

CREATE OR REPLACE FUNCTION public.submit_external_response(access_token_param uuid, response_text_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
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

CREATE OR REPLACE FUNCTION public.grant_user_module(p_user_id uuid, p_module app_module, p_granted_by uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  module_id UUID;
BEGIN
  -- Insert or update module access
  INSERT INTO public.user_modules (user_id, module, enabled, granted_by)
  VALUES (p_user_id, p_module, true, p_granted_by)
  ON CONFLICT (user_id, module) 
  DO UPDATE SET 
    enabled = true,
    granted_by = p_granted_by,
    updated_at = now()
  RETURNING id INTO module_id;
  
  -- Log the module grant
  PERFORM public.log_system_activity(
    'user_modules',
    'MODULE_GRANTED',
    p_user_id,
    NULL,
    jsonb_build_object(
      'module', p_module,
      'granted_by', p_granted_by
    )
  );
  
  RETURN module_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_nhs_email(email_address text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN email_address ~* '^[^@]+@(nhs\.net|nhs\.uk|nhft\.nhs\.uk)$';
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_complaint_compliance(complaint_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
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

CREATE OR REPLACE FUNCTION public.get_complaint_compliance_summary(complaint_id_param uuid)
RETURNS TABLE(total_items integer, compliant_items integer, compliance_percentage numeric, outstanding_items text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT 
    COUNT(*)::INTEGER as total_items,
    SUM(CASE WHEN is_compliant THEN 1 ELSE 0 END)::INTEGER as compliant_items,
    ROUND((SUM(CASE WHEN is_compliant THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)) * 100, 1) as compliance_percentage,
    ARRAY_AGG(compliance_item) FILTER (WHERE NOT is_compliant) as outstanding_items
  FROM public.complaint_compliance_checks
  WHERE complaint_id = complaint_id_param;
$function$;