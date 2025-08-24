-- Insert Insuject formulary data (providing all required fields)
INSERT INTO public.icb_formulary (
  drug_name, 
  status, 
  prior_approval_required, 
  icb_region,
  name, 
  name_norm, 
  bnf_chapter, 
  formulary_status,
  prior_approval_pdf_url, 
  prior_approval_page_ref, 
  last_reviewed, 
  source
)
VALUES (
  'Insuject', 
  'Double Red', 
  true, 
  'NHS Northamptonshire ICB',
  'Insuject', 
  'insuject', 
  '06 - Endocrine system', 
  'Double Red',
  'https://www.icnorthamptonshire.org.uk/download.cfm?doc=docm93jijm4n22499&ver=66342',
  'Section: Double Red Devices; Page 14', 
  now(), 
  'ICN ICB'
)
ON CONFLICT (name_norm) DO UPDATE
SET drug_name = EXCLUDED.drug_name,
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    formulary_status = EXCLUDED.formulary_status,
    prior_approval_required = EXCLUDED.prior_approval_required,
    prior_approval_pdf_url = EXCLUDED.prior_approval_pdf_url,
    prior_approval_page_ref = EXCLUDED.prior_approval_page_ref,
    last_reviewed = EXCLUDED.last_reviewed,
    updated_at = now();

-- Insert Insuject prior approval criteria
INSERT INTO public.prior_approval_criteria (drug_name_norm, criteria_text, category, application_route, icb_version, icb_pdf_url)
VALUES
('insuject', 'Only for patients meeting ICB criteria for insulin delivery devices where safety and dexterity needs are documented in primary care notes.', 'Double Red – Prior Approval', 'Blueteq', 'Aug 2025 (v6.6.342)',
 'https://www.icnorthamptonshire.org.uk/download.cfm?doc=docm93jijm4n22499&ver=66342'),
('insuject', 'Evidence required: prior unsuccessful trial of alternative devices OR documented clinical need (e.g., visual impairment, manual dexterity limitation).', 'Double Red – Prior Approval', 'Blueteq', 'Aug 2025 (v6.6.342)',
 'https://www.icnorthamptonshire.org.uk/download.cfm?doc=docm93jijm4n22499&ver=66342');