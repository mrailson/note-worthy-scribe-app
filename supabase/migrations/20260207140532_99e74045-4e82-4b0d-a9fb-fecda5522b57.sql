
-- Step 1: Clean up ALL existing duplicates across all complaints
-- For each (complaint_id, compliance_item) group, keep the best record (compliant preferred, then newest)
DELETE FROM public.complaint_compliance_checks
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY complaint_id, compliance_item
        ORDER BY 
          is_compliant DESC,           -- keep compliant ones first
          checked_at DESC NULLS LAST,  -- then most recently checked
          created_at DESC NULLS LAST   -- then most recently created
      ) AS rn
    FROM public.complaint_compliance_checks
  ) ranked
  WHERE rn > 1
);

-- Step 2: Add a unique constraint to prevent future duplicates at the DB level
ALTER TABLE public.complaint_compliance_checks
  ADD CONSTRAINT uq_complaint_compliance_item UNIQUE (complaint_id, compliance_item);

-- Step 3: Recreate the initialize function with ON CONFLICT DO NOTHING
DROP FUNCTION IF EXISTS public.initialize_complaint_compliance(uuid);

CREATE OR REPLACE FUNCTION public.initialize_complaint_compliance(p_complaint_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert all 15 compliance check items — ON CONFLICT prevents duplicates
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
    (p_complaint_id, '(11) Response letter includes escalation routes', 'Mandatory under NHS Complaints Regulations 2009. Must include Parliamentary and Health Service Ombudsman (PHSO) details. Shows transparency.'),
    (p_complaint_id, '(12) Learning and improvements identified', 'CQC Regulation 17 requires continuous improvement systems. Key evidence for learning culture and quality improvement (CQC: Well-led domain).'),
    (p_complaint_id, '(13) Action plan developed and implemented', 'Demonstrates commitment to service improvement. CQC expects evidence of actions taken following complaints. Shows responsive leadership.'),
    (p_complaint_id, '(14) Outcome communicated to relevant staff', 'Part of learning culture and staff development. CQC Regulation 18 (Staffing) includes keeping staff informed. Supports continuous improvement.'),
    (p_complaint_id, '(15) Follow-up review scheduled if required', 'Best practice for quality assurance. Demonstrates commitment to sustained improvement and monitoring of implemented changes.')
  ON CONFLICT (complaint_id, compliance_item) DO NOTHING;
END;
$$;
