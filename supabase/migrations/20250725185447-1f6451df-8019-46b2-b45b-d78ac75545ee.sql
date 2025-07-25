-- Create complaint compliance tracking table
CREATE TABLE public.complaint_compliance_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  compliance_item TEXT NOT NULL,
  is_compliant BOOLEAN NOT NULL DEFAULT false,
  evidence TEXT,
  notes TEXT,
  checked_by UUID REFERENCES auth.users(id),
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_compliance_checks ENABLE ROW LEVEL SECURITY;

-- RLS policies for compliance checks
CREATE POLICY "Users can view compliance checks for their practice complaints"
ON public.complaint_compliance_checks
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

CREATE POLICY "Authenticated users can manage compliance checks"
ON public.complaint_compliance_checks
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

-- Function to initialize compliance checklist for a new complaint
CREATE OR REPLACE FUNCTION public.initialize_complaint_compliance(complaint_id_param UUID)
RETURNS VOID
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

-- Function to get compliance summary for a complaint
CREATE OR REPLACE FUNCTION public.get_complaint_compliance_summary(complaint_id_param UUID)
RETURNS TABLE (
  total_items INTEGER,
  compliant_items INTEGER,
  compliance_percentage NUMERIC,
  outstanding_items TEXT[]
)
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