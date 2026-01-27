-- Seed remaining policies: HR, Patient Services, Business Continuity

INSERT INTO public.policy_reference_library (policy_name, category, cqc_kloe, priority, guidance_sources, required_services, required_roles, description) VALUES
-- HR & Workforce Policies (3.4)
('Recruitment & Selection', 'HR', 'Safe', 'Essential', '["Equality Act 2010", "NHS Employment Check Standards"]'::jsonb, '{}', '{}', 'Fair and safe recruitment practices'),
('DBS & Disclosure', 'HR', 'Safe', 'Essential', '["Safeguarding Vulnerable Groups Act 2006", "DBS Code of Practice"]'::jsonb, '{}', '{}', 'DBS checking procedures'),
('Training & Development', 'HR', 'Effective', 'Essential', '["Skills for Health Core Skills Training Framework"]'::jsonb, '{}', '{}', 'Staff training and development'),
('Induction', 'HR', 'Well-led', 'Essential', '["CQC Regulation 18", "NHS Employers Induction Standards"]'::jsonb, '{}', '{}', 'New staff induction programme'),
('Disciplinary', 'HR', 'Well-led', 'Essential', '["ACAS Code of Practice"]'::jsonb, '{}', '{}', 'Disciplinary procedures'),
('Grievance', 'HR', 'Well-led', 'Essential', '["ACAS Code of Practice"]'::jsonb, '{}', '{}', 'Staff grievance procedures'),
('Whistleblowing (Freedom to Speak Up)', 'HR', 'Well-led', 'Essential', '["Public Interest Disclosure Act 1998", "NHS FTSU Guidance"]'::jsonb, '{}', '{}', 'Raising concerns safely'),
('Equality, Diversity & Inclusion', 'HR', 'Well-led', 'Essential', '["Equality Act 2010", "NHS Equality Delivery System"]'::jsonb, '{}', '{}', 'Promoting equality and inclusion'),
('Bullying & Harassment', 'HR', 'Well-led', 'Essential', '["ACAS Guidance", "Equality Act 2010"]'::jsonb, '{}', '{}', 'Preventing bullying and harassment'),
('Sickness Absence', 'HR', 'Well-led', 'Essential', '["Fit Note Guidance", "ACAS Managing Attendance"]'::jsonb, '{}', '{}', 'Managing sickness absence'),
('Annual Leave', 'HR', 'Well-led', 'Recommended', '["Working Time Regulations 1998"]'::jsonb, '{}', '{}', 'Annual leave entitlement and booking'),
('Flexible Working', 'HR', 'Well-led', 'Recommended', '["Flexible Working Regulations 2014"]'::jsonb, '{}', '{}', 'Flexible working requests'),
('Maternity, Paternity & Adoption', 'HR', 'Well-led', 'Essential', '["Employment Rights Act 1996", "Equality Act 2010"]'::jsonb, '{}', '{}', 'Family leave entitlements'),
('Performance Management & Appraisal', 'HR', 'Effective', 'Essential', '["GMC/NMC Revalidation", "NHS Appraisal Requirements"]'::jsonb, '{}', '{}', 'Staff appraisal and performance'),
('Professional Registration', 'HR', 'Safe', 'Essential', '["GMC, NMC, GPhC, HCPC Registration Requirements"]'::jsonb, '{}', '{}', 'Maintaining professional registration'),
('Managing Doctors in Difficulty', 'HR', 'Well-led', 'Recommended', '["NHS England Managing Concerns Guidance"]'::jsonb, '{}', '{}', 'Supporting doctors with performance concerns'),

-- Patient Services Policies (3.5)
('Complaints Handling', 'Patient Services', 'Responsive', 'Essential', '["NHS Complaints Regulations 2009", "Parliamentary & Health Service Ombudsman"]'::jsonb, '{}', '{"complaints_lead"}', 'Managing patient complaints'),
('Significant Event Analysis', 'Patient Services', 'Well-led', 'Essential', '["NHS England SEA Framework", "CQC Learning from Deaths"]'::jsonb, '{}', '{}', 'Learning from significant events'),
('Patient Registration', 'Patient Services', 'Responsive', 'Essential', '["NHS England Patient Registration Guidance"]'::jsonb, '{}', '{}', 'Patient registration procedures'),
('Removal of Patients from List', 'Patient Services', 'Responsive', 'Essential', '["NHS England Patient Removal Guidance"]'::jsonb, '{}', '{}', 'Removing patients from practice list'),
('Home Visits', 'Patient Services', 'Responsive', 'Essential', '["GMS Contract", "CQC Safe Care & Treatment"]'::jsonb, '{}', '{}', 'Home visit procedures'),
('Carers Policy', 'Patient Services', 'Caring', 'Recommended', '["Care Act 2014", "NHS Long Term Plan Carers Chapter"]'::jsonb, '{}', '{}', 'Supporting carers'),
('Accessible Information Standard', 'Patient Services', 'Responsive', 'Essential', '["Accessible Information Standard 2016"]'::jsonb, '{}', '{}', 'Meeting communication needs'),
('Translation & Interpretation', 'Patient Services', 'Responsive', 'Essential', '["NHS England Interpreter Services Guidance"]'::jsonb, '{}', '{}', 'Language support services'),
('Patient Feedback & Engagement', 'Patient Services', 'Responsive', 'Recommended', '["CQC Patient Experience", "Friends & Family Test"]'::jsonb, '{}', '{}', 'Patient feedback mechanisms'),
('Zero Tolerance', 'Patient Services', 'Safe', 'Essential', '["NHS Protect", "Violence Prevention & Reduction Standards"]'::jsonb, '{}', '{}', 'Zero tolerance to violence'),
('Dignity & Respect', 'Patient Services', 'Caring', 'Essential', '["NHS Constitution", "CQC Dignity Champions"]'::jsonb, '{}', '{}', 'Treating patients with dignity'),
('Patient Identification', 'Patient Services', 'Safe', 'Essential', '["NHS Patient Safety Alert", "WHO Patient ID Guidelines"]'::jsonb, '{}', '{}', 'Correct patient identification'),
('Test Results Management', 'Patient Services', 'Safe', 'Essential', '["NHS England Results Management Guidance"]'::jsonb, '{}', '{}', 'Managing test results safely'),
('Referral Management', 'Patient Services', 'Effective', 'Essential', '["NHS e-Referral Service Standards"]'::jsonb, '{}', '{}', 'Managing patient referrals'),
('Care Navigation', 'Patient Services', 'Effective', 'Recommended', '["NHS England Care Navigation Guidance"]'::jsonb, '{}', '{}', 'Care navigation and signposting'),

-- Business Continuity & Governance (3.6)
('Business Continuity Plan', 'Business Continuity', 'Well-led', 'Essential', '["NHS England EPRR Framework", "ISO 22301"]'::jsonb, '{}', '{}', 'Business continuity planning'),
('Disaster Recovery', 'Business Continuity', 'Well-led', 'Essential', '["NHS Digital Business Continuity Guidance"]'::jsonb, '{}', '{}', 'IT disaster recovery'),
('Pandemic Response', 'Business Continuity', 'Well-led', 'Essential', '["UKHSA Guidance", "NHS England Pandemic Planning"]'::jsonb, '{}', '{}', 'Pandemic preparedness and response'),
('Financial Management', 'Business Continuity', 'Well-led', 'Essential', '["NHS Finance Guidance", "GMS Contract"]'::jsonb, '{}', '{}', 'Financial management and controls'),
('Procurement', 'Business Continuity', 'Well-led', 'Recommended', '["NHS Procurement Standards"]'::jsonb, '{}', '{}', 'Procurement procedures'),
('Environmental Sustainability', 'Business Continuity', 'Well-led', 'Recommended', '["NHS Net Zero", "Greener NHS Programme"]'::jsonb, '{}', '{}', 'Environmental sustainability'),
('Quality Improvement', 'Business Continuity', 'Effective', 'Recommended', '["NHS England QI Connect", "Model for Improvement"]'::jsonb, '{}', '{}', 'Quality improvement methodology'),
('Partnership Working', 'Business Continuity', 'Well-led', 'Recommended', '["NHS Long Term Plan", "ICS Frameworks"]'::jsonb, '{}', '{}', 'Working in partnership'),
('Locum & Agency Staff', 'Business Continuity', 'Safe', 'Essential', '["NHS Employers Agency Guidance", "IR35"]'::jsonb, '{}', '{}', 'Managing locum and agency staff'),
('Premises Management', 'Business Continuity', 'Safe', 'Essential', '["NHS Premises Assurance Model (PAM)"]'::jsonb, '{}', '{}', 'Premises management and safety');