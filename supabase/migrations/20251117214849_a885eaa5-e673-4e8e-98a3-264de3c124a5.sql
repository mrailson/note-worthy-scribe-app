-- Fix Remaining High Priority Security Issues - Function Search Paths (Part 2)

-- Function: auto_complete_compliance_on_close
CREATE OR REPLACE FUNCTION public.auto_complete_compliance_on_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    UPDATE complaint_compliance_checks
    SET 
      is_compliant = true,
      checked_at = CASE 
        WHEN checked_at IS NULL THEN now()
        ELSE checked_at
      END,
      checked_by = CASE 
        WHEN checked_by IS NULL THEN auth.uid()
        ELSE checked_by
      END
    WHERE complaint_id = NEW.id
    AND is_compliant = false;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Function: fix_complaint_status_inconsistencies
CREATE OR REPLACE FUNCTION public.fix_complaint_status_inconsistencies()
RETURNS TABLE(reference_number text, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE complaints
  SET 
    status = 'closed',
    updated_at = NOW()
  WHERE closed_at IS NOT NULL AND status != 'closed'
  RETURNING complaints.reference_number, 'under_review'::text AS old_status, 'closed'::text AS new_status;
END;
$function$;

-- Function: get_complaint_compliance_summary
CREATE OR REPLACE FUNCTION public.get_complaint_compliance_summary(p_complaint_id uuid)
RETURNS TABLE(complaint_id uuid, total_checks bigint, completed_checks bigint, compliance_percentage numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ccc.complaint_id,
    COUNT(*)::bigint as total_checks,
    COUNT(*) FILTER (WHERE ccc.is_compliant = true)::bigint as completed_checks,
    ROUND((COUNT(*) FILTER (WHERE ccc.is_compliant = true)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100, 1) as compliance_percentage
  FROM complaint_compliance_checks ccc
  WHERE ccc.complaint_id = p_complaint_id
  GROUP BY ccc.complaint_id;
END;
$function$;

-- Function: initialize_complaint_compliance
CREATE OR REPLACE FUNCTION public.initialize_complaint_compliance(p_complaint_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.complaint_compliance_checks (complaint_id, compliance_item, notes)
  VALUES
    (p_complaint_id, '(1) Complaint logged in practice register', 'Demonstrates compliance with NHS England Local Authority Social Services and NHS Complaints Regulations 2009, Regulation 15. CQC Regulation 16.2 requires proper record-keeping.'),
    (p_complaint_id, '(2) Acknowledgement sent within 3 working days', 'Required under NHS Complaints Regulations 2009, Regulation 14. Demonstrates timely response and patient-centred care (CQC Key Line of Enquiry: Responsive).'),
    (p_complaint_id, '(3) Complainant informed of investigation timescales', 'Transparency requirement under NHS Complaints Regulations 2009. Shows effective communication and person-centred approach (CQC Regulation 17.2).'),
    (p_complaint_id, '(4) Confidentiality maintained throughout', 'Data Protection Act 2018, GDPR Article 6. CQC Regulation 17 requires proper information governance. Essential for maintaining patient trust.'),
    (p_complaint_id, '(5) Fair and thorough investigation conducted', 'CQC Regulation 17 (Good Governance) requires effective systems to assess and monitor service quality. Demonstrates duty of candour compliance.'),
    (p_complaint_id, '(6) Relevant staff interviewed/statements taken', 'Part of thorough investigation process. CQC expects comprehensive evidence gathering. Shows commitment to learning culture (CQC Key Line of Enquiry: Well-led).'),
    (p_complaint_id, '(7) Medical records reviewed where appropriate', 'Clinical governance requirement. Essential for evidence-based investigation. CQC Regulation 17 requires accurate record review.'),
    (p_complaint_id, '(8) Senior management oversight documented', 'CQC Regulation 17 (Good Governance) requires leadership accountability. Demonstrates management engagement and oversight of complaint handling.'),
    (p_complaint_id, '(9) Investigation completed within 20 working days', 'Standard under NHS Complaints Regulations 2009. Extensions must be agreed with complainant. Shows responsive service delivery.'),
    (p_complaint_id, '(10) Response addresses all points raised', 'NHS Complaints Regulations 2009, Regulation 14(3) requires comprehensive response. Demonstrates person-centred care and thoroughness.'),
    (p_complaint_id, '(11) Outcome letter sent to complainant', 'NHS Complaints Regulations 2009, Regulation 14(4) requires written response. Must explain findings, conclusions, and any actions.'),
    (p_complaint_id, '(12) Learning points identified and documented', 'CQC Regulation 17 requires learning from incidents. Shows commitment to continuous improvement and quality assurance.'),
    (p_complaint_id, '(13) Action plan created where applicable', 'Good governance requirement. CQC expects evidence of service improvement following complaints. Demonstrates responsive leadership.'),
    (p_complaint_id, '(14) Significant event analysis completed if needed', 'Part of clinical governance framework. Required for serious complaints. Shows thorough analysis and learning culture (CQC Well-led domain).'),
    (p_complaint_id, '(15) Review with practice team completed', 'Essential for shared learning. CQC expects evidence of team engagement in complaint learning. Promotes culture of openness and continuous improvement.');
END;
$function$;

-- Function: check_temperature_range
CREATE OR REPLACE FUNCTION public.check_temperature_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fridge_record public.practice_fridges%ROWTYPE;
BEGIN
  SELECT * INTO fridge_record 
  FROM public.practice_fridges 
  WHERE id = NEW.fridge_id;
  
  NEW.is_within_range = (
    NEW.temperature_celsius >= fridge_record.min_temp_celsius AND 
    NEW.temperature_celsius <= fridge_record.max_temp_celsius
  );
  
  IF NOT NEW.is_within_range THEN
    INSERT INTO public.fridge_temperature_alerts (
      fridge_id,
      reading_id,
      alert_type,
      severity,
      message
    ) VALUES (
      NEW.fridge_id,
      NEW.id,
      'temperature_out_of_range',
      CASE 
        WHEN NEW.temperature_celsius < fridge_record.min_temp_celsius - 2 OR 
             NEW.temperature_celsius > fridge_record.max_temp_celsius + 2 
        THEN 'critical'
        ELSE 'high'
      END,
      'Temperature ' || NEW.temperature_celsius || '°C is outside acceptable range (' || 
      fridge_record.min_temp_celsius || '°C - ' || fridge_record.max_temp_celsius || '°C)'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Function: update_medical_corrections_updated_at
CREATE OR REPLACE FUNCTION public.update_medical_corrections_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function: log_security_event (first overload with detailed params)
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text, 
  p_severity text DEFAULT 'medium'::text, 
  p_user_id uuid DEFAULT NULL::uuid, 
  p_user_email text DEFAULT NULL::text, 
  p_ip_address inet DEFAULT NULL::inet, 
  p_user_agent text DEFAULT NULL::text, 
  p_event_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.security_events (
    event_type,
    severity,
    user_id,
    user_email,
    ip_address,
    user_agent,
    event_details
  ) VALUES (
    p_event_type,
    p_severity,
    p_user_id,
    p_user_email,
    p_ip_address,
    p_user_agent,
    p_event_details
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$function$;

-- Function: log_security_event (second overload with simple params)
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text, 
  p_user_id uuid, 
  p_details jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  SELECT public.log_system_activity(
    'security_events',
    p_event_type,
    p_user_id,
    NULL,
    p_details
  ) INTO log_id;
  
  RETURN log_id;
END;
$function$;

-- Function: log_security_event (third overload with event_data)
CREATE OR REPLACE FUNCTION public.log_security_event(event_type text, event_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.security_events (event_type, event_details)
    VALUES (event_type, event_data);
END;
$function$;

-- Function: log_complaint_view
CREATE OR REPLACE FUNCTION public.log_complaint_view(
  p_complaint_id uuid, 
  p_view_context text DEFAULT 'general'::text, 
  p_ip_address text DEFAULT NULL::text, 
  p_user_agent text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    
    INSERT INTO complaint_audit_detailed (
      complaint_id,
      action_type,
      action_description,
      user_id,
      user_email,
      ip_address,
      user_agent,
      created_at
    ) VALUES (
      p_complaint_id,
      'view',
      'Complaint viewed - ' || p_view_context,
      v_user_id,
      v_user_email,
      p_ip_address,
      p_user_agent,
      NOW()
    );
  END IF;
END;
$function$;