-- Create table for demo complaint responses
CREATE TABLE public.complaint_demo_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_reference TEXT UNIQUE NOT NULL,
  key_findings TEXT NOT NULL,
  actions_taken TEXT NOT NULL,
  improvements_made TEXT NOT NULL,
  additional_context TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_demo_responses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read demo responses
CREATE POLICY "Authenticated users can view demo responses"
ON public.complaint_demo_responses
FOR SELECT
TO authenticated
USING (true);

-- Seed demo responses for all 20 demo complaints
INSERT INTO public.complaint_demo_responses (complaint_reference, key_findings, actions_taken, improvements_made, additional_context) VALUES
('COMP250001', 'Patient experienced 8-minute wait at reception before being acknowledged.', 'Staff member counselled on greeting protocol; Reception rota adjusted for better coverage.', 'Implemented 2-minute acknowledgement standard; Added visible welcome signage.', 'Reception staff now trained in customer service excellence. Monthly audits introduced.'),
('COMP250002', 'Prescription sent to incorrect pharmacy despite clear patient instruction.', 'Pharmacy selection process reviewed; Staff member received retraining on verification.', 'Introduced double-check system; Enhanced EPS training for all clinical staff.', 'New protocol ensures patient confirms pharmacy details before prescription sent.'),
('COMP250003', 'Patient records showed appointment booked but not recorded in GP diary system.', 'IT system audit completed; Synchronisation issue identified and resolved.', 'Implemented real-time diary sync checks; Added confirmation SMS system.', 'Weekly IT system health checks now standard. Backup booking log maintained.'),
('COMP250004', 'Staff member did not follow confidentiality protocol during telephone consultation.', 'Privacy breach protocol activated; Staff member completed refresher training.', 'Enhanced telephone consultation guidelines; Private rooms allocated for calls.', 'All staff completed GDPR refresher. Quarterly confidentiality audits implemented.'),
('COMP250005', 'Receptionist tone perceived as dismissive when patient requested urgent appointment.', 'Customer service training provided; Formal apology issued to patient.', 'Introduced empathy training programme; Updated urgent appointment protocol.', 'Reception team now has monthly scenario-based training. Patient feedback improved.'),
('COMP250006', 'Test results not communicated to patient within promised 5-day timeframe.', 'Results tracking system reviewed; Communication protocol strengthened.', 'Automated results notification system implemented; 3-day standard introduced.', 'Pathology liaison improved. Patients now receive SMS when results available.'),
('COMP250007', 'Home visit requested for housebound patient was not prioritised appropriately.', 'Triage system reviewed; Home visit protocol updated and clarified.', 'Introduced priority flagging system; Daily home visit coordination meeting.', 'Housebound patients now have dedicated care coordinator. 24-hour response standard.'),
('COMP250008', 'Patient referral letter contained clinical inaccuracies requiring correction.', 'Clinical documentation audit conducted; Referral process enhanced.', 'Implemented peer review system for complex referrals; Template standardisation.', 'All referral letters now reviewed by second clinician before sending.'),
('COMP250009', 'Repeat prescription issued incorrectly despite recent medication change.', 'Medication review process strengthened; Prescribing safeguards enhanced.', 'Introduced medication alert system; Weekly repeat prescription audits.', 'Clinical pharmacist now reviews all repeat prescriptions. Patient safety improved.'),
('COMP250010', 'Prescription sent to incorrect pharmacy despite clear patient instruction.', 'Pharmacy selection process reviewed; Staff member received retraining on verification.', 'Introduced double-check system; Enhanced EPS training for all clinical staff.', 'New protocol ensures patient confirms pharmacy details before prescription sent.'),
('COMP250011', 'Appointment booking system double-booked patient causing significant inconvenience.', 'Booking system audit completed; Software update applied to prevent recurrence.', 'Introduced booking conflict detection; Real-time availability checking.', 'IT supplier provided patch. Additional staff training on booking system.'),
('COMP250012', 'Patient not informed that consultation would involve medical student observation.', 'Consent process reviewed; Clear signage now displayed in consulting rooms.', 'Introduced mandatory verbal consent for student presence; Opt-out system.', 'All teaching consultations now clearly flagged at booking. Patient choice respected.'),
('COMP250013', 'Appointment booking system double-booked patient causing significant inconvenience.', 'Booking system audit completed; Software update applied to prevent recurrence.', 'Introduced booking conflict detection; Real-time availability checking.', 'IT supplier provided patch. Additional staff training on booking system.'),
('COMP250014', 'Patient medication delivered to wrong address due to administrative error.', 'Delivery address verification process enhanced; Staff retraining completed.', 'Introduced address confirmation at every prescription request; Audit trail.', 'Pharmacy delivery partners now require signature confirmation. Error rate reduced.'),
('COMP250015', 'Clinical waste collection missed resulting in unsightly bins for extended period.', 'Contract management reviewed; Escalation procedure with waste contractor activated.', 'Introduced backup waste collection provider; Weekly inspection schedule.', 'Facilities team now has direct contractor contact. Penalty clauses activated.'),
('COMP250016', 'Patient blood test appointment scheduled but phlebotomy service unexpectedly closed.', 'Service communication improved; Patient notification system enhanced.', 'Introduced real-time service availability updates; SMS alerts for changes.', 'Phlebotomy rota now shared with reception. Patients contacted proactively.'),
('COMP250017', 'Patient felt rushed during consultation and key symptoms not adequately explored.', 'Consultation quality reviewed with clinician; Patient-centred approach reinforced.', 'Introduced minimum consultation time standards; Communication skills training.', 'Clinical supervision enhanced. Patient satisfaction scores monitored monthly.'),
('COMP250018', 'Accessibility ramp blocked by delivery making wheelchair access impossible.', 'Delivery protocol updated; Designated delivery zones clearly marked.', 'Introduced accessibility audit schedule; Staff designated as access champions.', 'All staff trained on Equality Act requirements. Quarterly access reviews.'),
('COMP250019', 'Patient emergency call not returned promptly due to message system failure.', 'Telephone system audit completed; Redundancy measures implemented.', 'Introduced backup message system; Emergency call priority protocol.', 'IT infrastructure upgraded. Emergency calls now have dedicated line.'),
('COMP250020', 'Patient medical records contained inaccurate historical information.', 'Records accuracy audit initiated; Correction protocol activated.', 'Introduced patient record review service; Annual accuracy verification.', 'Patients now encouraged to review records annually. Data quality improved.');