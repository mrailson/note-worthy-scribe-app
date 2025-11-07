-- Create demo responses for appointment cancellation complaints
-- These are realistic GP practice responses for demonstration purposes

INSERT INTO complaint_demo_responses (
  complaint_reference, 
  key_findings, 
  actions_taken, 
  improvements_made, 
  additional_context
) VALUES 
-- COMP250028 (James Williams - Appointment Cancellations)
(
  'COMP250028',
  'Investigation confirmed four appointments cancelled without adequate notice. SMS notification system failed twice. Reception staff did not follow protocol.',
  'Apology issued to Mr Williams. Priority appointment arranged with physiotherapist. Staff reminded of cancellation procedures. Patient contact details verified.',
  'Dual notification system implemented (SMS + phone call). Reception checklist introduced. Weekly review of cancelled appointments to ensure contact.',
  'Mr Williams experienced unacceptable disruption. His chronic back pain treatment has been prioritised with comprehensive management plan. Close monitoring in place to prevent recurrence.'
),
-- COMP250032
(
  'COMP250032',
  'Investigation confirmed four appointments cancelled without adequate notice. SMS notification system failed twice. Reception staff did not follow protocol.',
  'Apology issued to Mr Williams. Priority appointment arranged with physiotherapist. Staff reminded of cancellation procedures. Patient contact details verified.',
  'Dual notification system implemented (SMS + phone call). Reception checklist introduced. Weekly review of cancelled appointments to ensure contact.',
  'Mr Williams experienced unacceptable disruption. His chronic back pain treatment has been prioritised with comprehensive management plan. Close monitoring in place to prevent recurrence.'
),
-- COMP250033
(
  'COMP250033',
  'Investigation confirmed four appointments cancelled without adequate notice. SMS notification system failed twice. Reception staff did not follow protocol.',
  'Apology issued to Mr Williams. Priority appointment arranged with physiotherapist. Staff reminded of cancellation procedures. Patient contact details verified.',
  'Dual notification system implemented (SMS + phone call). Reception checklist introduced. Weekly review of cancelled appointments to ensure contact.',
  'Mr Williams experienced unacceptable disruption. His chronic back pain treatment has been prioritised with comprehensive management plan. Close monitoring in place to prevent recurrence.'
),
-- COMP250035
(
  'COMP250035',
  'Investigation confirmed four appointments cancelled without adequate notice. SMS notification system failed twice. Reception staff did not follow protocol.',
  'Apology issued to Mr Williams. Priority appointment arranged with physiotherapist. Staff reminded of cancellation procedures. Patient contact details verified.',
  'Dual notification system implemented (SMS + phone call). Reception checklist introduced. Weekly review of cancelled appointments to ensure contact.',
  'Mr Williams experienced unacceptable disruption. His chronic back pain treatment has been prioritised with comprehensive management plan. Close monitoring in place to prevent recurrence.'
)
ON CONFLICT (complaint_reference) 
DO UPDATE SET
  key_findings = EXCLUDED.key_findings,
  actions_taken = EXCLUDED.actions_taken,
  improvements_made = EXCLUDED.improvements_made,
  additional_context = EXCLUDED.additional_context;