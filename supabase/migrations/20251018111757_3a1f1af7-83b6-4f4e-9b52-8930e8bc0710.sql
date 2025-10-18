-- Fix duplicate CQC compliance checks - ensure only 15 items exist

-- First, update the initialize function to prevent duplicates
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

  -- Insert all required NHS compliance items (exactly 15)
  INSERT INTO public.complaint_compliance_checks (complaint_id, compliance_item, is_compliant, evidence, notes)
  VALUES 
    (complaint_id_param, 'Acknowledgement sent within 3 working days', false, NULL, 'NHS England requirement'),
    (complaint_id_param, 'Investigation completed within 20 working days', false, NULL, 'NHS Constitution pledge'),
    (complaint_id_param, 'Patient consent obtained (if complaint made on behalf)', false, NULL, 'Data Protection Act 2018 and GDPR'),
    (complaint_id_param, 'All relevant staff notified and responses collected', false, NULL, 'Thorough investigation requirement'),
    (complaint_id_param, 'Clinical governance team involved (if clinical)', false, NULL, 'CQC Regulation 20 - Duty of candour'),
    (complaint_id_param, 'Patient safety incident reported (if applicable)', false, NULL, 'NHS Patient Safety Strategy 2019'),
    (complaint_id_param, 'Learning and improvement actions identified', false, NULL, 'CQC Learning from complaints'),
    (complaint_id_param, 'Response letter includes escalation routes', false, NULL, 'NHS complaints procedure - PHSO info'),
    (complaint_id_param, 'Complaint logged in practice register', false, NULL, 'CQC Regulation 16'),
    (complaint_id_param, 'Senior management oversight documented', false, NULL, 'Good governance'),
    (complaint_id_param, 'Confidentiality maintained throughout', false, NULL, 'Patient confidentiality and GDPR'),
    (complaint_id_param, 'Fair and thorough investigation conducted', false, NULL, 'NHS Constitution right'),
    (complaint_id_param, 'Response addresses all points raised', false, NULL, 'Comprehensive response'),
    (complaint_id_param, 'Apologetic tone where appropriate', false, NULL, 'Duty of candour'),
    (complaint_id_param, 'Quality improvement actions implemented', false, NULL, 'CQC Well-led domain')
  ON CONFLICT DO NOTHING;
END;
$function$;

-- Clean up any duplicate compliance checks (keep the most recent one per item)
WITH ranked_checks AS (
  SELECT 
    id,
    complaint_id,
    compliance_item,
    ROW_NUMBER() OVER (
      PARTITION BY complaint_id, compliance_item 
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM public.complaint_compliance_checks
)
DELETE FROM public.complaint_compliance_checks
WHERE id IN (
  SELECT id FROM ranked_checks WHERE rn > 1
);