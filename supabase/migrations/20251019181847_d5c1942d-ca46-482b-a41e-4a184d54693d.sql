-- Add demo responses for complaint COMP250017 (Medication Dispensing Error)
INSERT INTO complaint_demo_responses (
  complaint_reference,
  key_findings,
  actions_taken,
  improvements_made,
  additional_context
) VALUES (
  'COMP250017',
  'Investigation confirmed that the incorrect dosage of Amlodipine (10mg instead of 5mg) was dispensed due to a stock location error in the pharmacy. The medication was stored in the wrong compartment, leading to the dispensing mistake.',
  'The patient was contacted immediately, advised to stop taking the incorrect dosage, and the correct medication was dispensed the same day. The patient was offered a follow-up appointment to monitor blood pressure. The pharmacy stock has been reorganised and labelled clearly.',
  'Implemented a double-check system for all prescription dispensing. Staff have received refresher training on medication safety protocols. New labelling system installed in pharmacy storage areas to prevent similar errors.',
  'The practice pharmacist has been working with the team to review all high-risk medication protocols. We are also implementing a monthly audit of pharmacy stock organisation to maintain safety standards.'
)
ON CONFLICT (complaint_reference) DO UPDATE SET
  key_findings = EXCLUDED.key_findings,
  actions_taken = EXCLUDED.actions_taken,
  improvements_made = EXCLUDED.improvements_made,
  additional_context = EXCLUDED.additional_context;