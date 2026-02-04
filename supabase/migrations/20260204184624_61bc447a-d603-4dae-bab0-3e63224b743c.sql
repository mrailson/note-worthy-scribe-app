-- Create mock_inspection_element_templates table (seed data for inspection elements)
CREATE TABLE public.mock_inspection_element_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL CHECK (domain IN ('safe', 'effective', 'caring', 'responsive', 'well_led')),
    element_key TEXT NOT NULL UNIQUE,
    element_name TEXT NOT NULL,
    evidence_guidance TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    is_priority_domain BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create mock_inspection_sessions table
CREATE TABLE public.mock_inspection_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES public.gp_practices(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    report_generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create mock_inspection_elements table
CREATE TABLE public.mock_inspection_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.mock_inspection_sessions(id) ON DELETE CASCADE NOT NULL,
    domain TEXT NOT NULL CHECK (domain IN ('safe', 'effective', 'caring', 'responsive', 'well_led')),
    element_key TEXT NOT NULL,
    element_name TEXT NOT NULL,
    evidence_guidance TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_assessed' CHECK (status IN ('not_assessed', 'met', 'partially_met', 'not_met', 'not_applicable')),
    evidence_notes TEXT,
    improvement_comments TEXT,
    evidence_files JSONB DEFAULT '[]'::jsonb,
    assessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mock_inspection_element_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_inspection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_inspection_elements ENABLE ROW LEVEL SECURITY;

-- Templates are readable by all authenticated users
CREATE POLICY "Templates are readable by authenticated users"
ON public.mock_inspection_element_templates
FOR SELECT
TO authenticated
USING (true);

-- Sessions policies - users can manage their own sessions
CREATE POLICY "Users can view their own sessions"
ON public.mock_inspection_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create sessions"
ON public.mock_inspection_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
ON public.mock_inspection_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
ON public.mock_inspection_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Elements policies - users can manage elements in their sessions
CREATE POLICY "Users can view elements in their sessions"
ON public.mock_inspection_elements
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.mock_inspection_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create elements in their sessions"
ON public.mock_inspection_elements
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.mock_inspection_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update elements in their sessions"
ON public.mock_inspection_elements
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.mock_inspection_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete elements in their sessions"
ON public.mock_inspection_elements
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.mock_inspection_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    )
);

-- Create indexes for performance
CREATE INDEX idx_mock_inspection_sessions_user_id ON public.mock_inspection_sessions(user_id);
CREATE INDEX idx_mock_inspection_sessions_practice_id ON public.mock_inspection_sessions(practice_id);
CREATE INDEX idx_mock_inspection_elements_session_id ON public.mock_inspection_elements(session_id);
CREATE INDEX idx_mock_inspection_element_templates_domain ON public.mock_inspection_element_templates(domain);

-- Seed the templates with CQC inspection elements

-- SAFE DOMAIN (Priority)
INSERT INTO public.mock_inspection_element_templates (domain, element_key, element_name, evidence_guidance, priority, is_priority_domain) VALUES
('safe', 'S1', 'Safeguarding policies and procedures', 'Look for: Up-to-date safeguarding policy, named safeguarding lead, staff training records, DBS check register, safeguarding referral log, and evidence of regular policy reviews. Consider asking about recent safeguarding cases and how they were handled.', 1, true),
('safe', 'S2', 'Infection prevention and control', 'Look for: IPC policy, hand hygiene audits, cleaning schedules with sign-off, PPE availability and training, sharps disposal procedures, immunisation records for staff, and evidence of IPC training. Check clinical areas for cleanliness.', 2, true),
('safe', 'S3', 'Medicines management', 'Look for: Medicines policy, controlled drugs register with regular checks, fridge temperature logs, prescription security measures, repeat prescribing protocols, high-risk medicines monitoring, and staff training on medicines handling.', 3, true),
('safe', 'S4', 'Equipment safety and maintenance', 'Look for: Equipment inventory, PAT testing certificates, calibration records for medical devices, maintenance contracts, equipment training records, and procedures for reporting faulty equipment.', 4, true),
('safe', 'S5', 'Staff recruitment and DBS checks', 'Look for: Recruitment policy, DBS check register with renewal dates, references on file, professional registration checks (GMC/NMC), induction records, and evidence of identity verification.', 5, true),
('safe', 'S6', 'Health and safety risk assessments', 'Look for: General H&S risk assessment, COSHH assessments, lone working policy and risk assessment, display screen assessments, manual handling assessments, and evidence of regular reviews.', 6, true),
('safe', 'S7', 'Fire safety and emergency procedures', 'Look for: Fire risk assessment, fire evacuation plan, fire drill records, fire equipment testing certificates, emergency contact procedures, and staff training on fire safety.', 7, true),
('safe', 'S8', 'Significant event analysis and learning', 'Look for: SEA policy, log of significant events, completed SEA forms with action plans, evidence of learning shared with team, and links to complaints and near-misses.', 8, true),
('safe', 'S9', 'Patient safety alerts and recalls', 'Look for: System for receiving and acting on MHRA alerts, CAS alerts, patient safety alerts. Evidence of action taken on recent alerts and audit trail.', 9, true),
('safe', 'S10', 'Chaperone policy and training', 'Look for: Chaperone policy, list of trained chaperones, training records, signage in clinical areas, and documentation of chaperone use in notes.', 10, true),
('safe', 'S11', 'Clinical supervision arrangements', 'Look for: Clinical supervision policy, supervision records for nurses and HCAs, mentoring arrangements for trainees, and evidence of protected time for supervision.', 11, true),
('safe', 'S12', 'Premises safety and security', 'Look for: Premises risk assessment, security measures (CCTV, access control), emergency lighting tests, legionella risk assessment, asbestos register if applicable, and evidence of regular building checks.', 12, true);

-- WELL-LED DOMAIN (Priority)
INSERT INTO public.mock_inspection_element_templates (domain, element_key, element_name, evidence_guidance, priority, is_priority_domain) VALUES
('well_led', 'W1', 'Governance framework and accountability', 'Look for: Organisational structure chart, terms of reference for meetings, clear accountability arrangements, risk register, and evidence of board/partner oversight.', 1, true),
('well_led', 'W2', 'Staff training and appraisals', 'Look for: Training needs analysis, training matrix with completion dates, annual appraisal records for all staff, personal development plans, and evidence of mandatory training compliance.', 2, true),
('well_led', 'W3', 'Complaints handling and learning', 'Look for: Complaints policy, complaints log with outcomes, response time monitoring, evidence of learning from complaints, patient feedback mechanisms, and how themes are identified.', 3, true),
('well_led', 'W4', 'Quality improvement initiatives', 'Look for: QI projects (current and completed), clinical audits with action plans, benchmarking data, patient surveys and responses, and evidence of continuous improvement culture.', 4, true),
('well_led', 'W5', 'Business continuity planning', 'Look for: BCP document, tested and reviewed annually, covers IT failure, staff absence, premises issues, pandemic planning, and contact trees for emergencies.', 5, true),
('well_led', 'W6', 'Information governance and GDPR', 'Look for: Data protection policy, staff IG training records, data sharing agreements, subject access request procedures, privacy notices, and evidence of data breach procedures.', 6, true),
('well_led', 'W7', 'Staff engagement and wellbeing', 'Look for: Staff survey results and actions, wellbeing initiatives, freedom to speak up arrangements, sickness absence monitoring, and evidence of staff recognition.', 7, true),
('well_led', 'W8', 'Partnership working', 'Look for: Evidence of PCN engagement, relationships with community services, MDT meeting attendance, referral pathways, and collaborative working arrangements.', 8, true),
('well_led', 'W9', 'Financial management', 'Look for: Financial oversight arrangements, budget monitoring, contract compliance, and evidence of value for money considerations in procurement.', 9, true),
('well_led', 'W10', 'CQC registration compliance', 'Look for: Current CQC registration certificate displayed, registered manager in post, notification procedures understood, and previous inspection report actions addressed.', 10, true),
('well_led', 'W11', 'Policy review and version control', 'Look for: Policy index with review dates, version control system, evidence of staff access to policies, and process for policy approval and dissemination.', 11, true),
('well_led', 'W12', 'Leadership visibility and communication', 'Look for: Regular team meetings with minutes, communication channels (newsletters, noticeboards), open door policy, leadership walkabouts, and staff awareness of vision and values.', 12, true);

-- EFFECTIVE DOMAIN
INSERT INTO public.mock_inspection_element_templates (domain, element_key, element_name, evidence_guidance, priority, is_priority_domain) VALUES
('effective', 'E1', 'Evidence-based practice', 'Look for: Use of NICE guidelines, clinical pathways, and evidence of reviewing and updating clinical protocols in line with best practice.', 1, false),
('effective', 'E2', 'Clinical audit programme', 'Look for: Annual audit plan, completed audits with re-audit evidence, QOF achievement data, and actions arising from audit findings.', 2, false),
('effective', 'E3', 'Staff competency assessments', 'Look for: Competency frameworks for clinical staff, assessment records, and evidence of ongoing competency reviews.', 3, false),
('effective', 'E4', 'Consent processes', 'Look for: Consent policy, evidence of documented consent, mental capacity considerations, and Gillick competency awareness.', 4, false),
('effective', 'E5', 'Multidisciplinary working', 'Look for: MDT meeting records, shared care arrangements, and evidence of effective communication between professionals.', 5, false),
('effective', 'E6', 'Health promotion and prevention', 'Look for: Screening programmes, immunisation rates, health promotion materials, and proactive care for at-risk groups.', 6, false),
('effective', 'E7', 'Care planning and coordination', 'Look for: Care plans for long-term conditions, named GP arrangements, and evidence of coordinated care for complex patients.', 7, false),
('effective', 'E8', 'Outcomes monitoring', 'Look for: Patient outcome data, benchmarking against peers, and evidence of acting on outcome information.', 8, false);

-- CARING DOMAIN
INSERT INTO public.mock_inspection_element_templates (domain, element_key, element_name, evidence_guidance, priority, is_priority_domain) VALUES
('caring', 'C1', 'Patient dignity and respect', 'Look for: Privacy during consultations, respectful communication, and evidence from patient feedback about being treated with dignity.', 1, false),
('caring', 'C2', 'Involving patients in decisions', 'Look for: Shared decision-making evidence, patient information materials, and involvement in care planning.', 2, false),
('caring', 'C3', 'Compassionate care', 'Look for: Patient testimonials, complaint themes around compassion, and staff awareness of compassionate care principles.', 3, false),
('caring', 'C4', 'Emotional support', 'Look for: Signposting to support services, counselling arrangements, and staff training on emotional support.', 4, false),
('caring', 'C5', 'Carers recognition and support', 'Look for: Carers register, carers assessments, and signposting to carers support services.', 5, false),
('caring', 'C6', 'Patient feedback mechanisms', 'Look for: Friends and Family Test results, patient surveys, suggestions box, and how feedback is acted upon.', 6, false),
('caring', 'C7', 'Confidentiality in practice', 'Look for: Private areas for discussions, screen positioning, and staff awareness of confidentiality requirements.', 7, false),
('caring', 'C8', 'Cultural sensitivity', 'Look for: Interpreter services, cultural awareness training, and accommodations for diverse patient needs.', 8, false);

-- RESPONSIVE DOMAIN
INSERT INTO public.mock_inspection_element_templates (domain, element_key, element_name, evidence_guidance, priority, is_priority_domain) VALUES
('responsive', 'R1', 'Access to appointments', 'Look for: Appointment availability data, same-day access arrangements, telephone access audits, and online booking options.', 1, false),
('responsive', 'R2', 'Reasonable adjustments', 'Look for: Disability access, hearing loops, easy-read materials, and adjustments register for patients with specific needs.', 2, false),
('responsive', 'R3', 'Home visits policy', 'Look for: Home visit criteria, request process, and monitoring of home visit provision.', 3, false),
('responsive', 'R4', 'Out of hours information', 'Look for: Clear OOH information on website and answerphone, patient awareness, and handover arrangements.', 4, false),
('responsive', 'R5', 'Complaints accessibility', 'Look for: Visible complaints procedure, multiple ways to complain, and support for patients making complaints.', 5, false),
('responsive', 'R6', 'Waiting times management', 'Look for: Waiting time monitoring, patient communication about delays, and actions to reduce waiting.', 6, false),
('responsive', 'R7', 'Referral processes', 'Look for: e-RS usage, referral tracking, and patient communication about referrals.', 7, false),
('responsive', 'R8', 'Patient list management', 'Look for: New patient registration process, removals policy, and approach to challenging patients.', 8, false);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_mock_inspection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mock_inspection_sessions_updated_at
    BEFORE UPDATE ON public.mock_inspection_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_mock_inspection_updated_at();

CREATE TRIGGER update_mock_inspection_elements_updated_at
    BEFORE UPDATE ON public.mock_inspection_elements
    FOR EACH ROW
    EXECUTE FUNCTION public.update_mock_inspection_updated_at();