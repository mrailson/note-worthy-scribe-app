-- Enhanced compliance checklist evidence text
-- Updating the initialize_complaint_compliance function with more detailed evidence references

CREATE OR REPLACE FUNCTION public.initialize_complaint_compliance(complaint_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Check if compliance checks already exist for this complaint
  IF EXISTS (
    SELECT 1 FROM public.complaint_compliance_checks 
    WHERE complaint_id = complaint_id_param
  ) THEN
    -- Already initialized, skip
    RETURN;
  END IF;

  -- Insert all required NHS compliance items (exactly 15) with enhanced evidence references
  INSERT INTO public.complaint_compliance_checks (complaint_id, compliance_item, is_compliant, evidence, notes)
  VALUES 
    (complaint_id_param, 'Acknowledgement sent within 3 working days', false, NULL, 'NHS England Local Authority Social Services and NHS Complaints Regulations 2009'),
    (complaint_id_param, 'Investigation completed within 20 working days', false, NULL, 'NHS Constitution Right 5 - complaint investigation within agreed timescales'),
    (complaint_id_param, 'Patient consent obtained (if complaint made on behalf)', false, NULL, 'Data Protection Act 2018, GDPR Article 6, and NHS IG Toolkit requirements'),
    (complaint_id_param, 'All relevant staff notified and responses collected', false, NULL, 'CQC Regulation 16.2 - thorough investigation and appropriate action'),
    (complaint_id_param, 'Clinical governance team involved (if clinical)', false, NULL, 'CQC Regulation 20 - Duty of candour and clinical governance framework'),
    (complaint_id_param, 'Patient safety incident reported (if applicable)', false, NULL, 'NHS Patient Safety Strategy 2019 and National Reporting Learning System'),
    (complaint_id_param, 'Learning and improvement actions identified', false, NULL, 'CQC Key Line of Enquiry: Learning from complaints and concerns'),
    (complaint_id_param, 'Response letter includes escalation routes', false, NULL, 'NHS complaints procedure - Parliamentary and Health Service Ombudsman pathway'),
    (complaint_id_param, 'Complaint logged in practice register', false, NULL, 'CQC Regulation 16.3 - record keeping and complaints monitoring'),
    (complaint_id_param, 'Senior management oversight documented', false, NULL, 'CQC Well-led domain - governance, leadership and accountability'),
    (complaint_id_param, 'Confidentiality maintained throughout', false, NULL, 'NHS Confidentiality Code of Practice, GDPR Article 5, and Caldicott Principles'),
    (complaint_id_param, 'Fair and thorough investigation conducted', false, NULL, 'NHS Constitution Right 4 - fair consideration of complaints'),
    (complaint_id_param, 'Response addresses all points raised', false, NULL, 'NHS Complaints Regulations 2009 - full and proportionate investigation'),
    (complaint_id_param, 'Apologetic tone where appropriate', false, NULL, 'Duty of candour (Health and Social Care Act 2008) and NHS apology guidance'),
    (complaint_id_param, 'Quality improvement actions implemented', false, NULL, 'CQC Well-led Key Lines of Enquiry - continuous improvement culture')
  ON CONFLICT DO NOTHING;
END;
$function$;