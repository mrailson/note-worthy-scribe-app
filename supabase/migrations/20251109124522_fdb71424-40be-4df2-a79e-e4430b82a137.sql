-- Add demo response for COMP250041
INSERT INTO complaint_demo_responses (complaint_reference, key_findings, actions_taken, improvements_made, additional_context)
VALUES (
  'COMP250041',
  'Investigation revealed that reception staff member spoke dismissively to the patient during check-in on 15th March. Patient felt their concerns about appointment timing were not taken seriously. Staff member acknowledged the interaction could have been handled more professionally.',
  'Immediate discussion held with staff member regarding professional communication standards. Patient contacted with formal apology. Staff member to undergo refresher training on customer service and communication skills scheduled for next month.',
  'Updated reception desk protocols to include reminder cards about empathetic communication. Monthly team meetings now include customer service scenarios and role-play exercises. Feedback system introduced for patients to rate reception experience.',
  'This incident occurred during a particularly busy morning clinic with several emergency walk-ins. Whilst this does not excuse the behaviour, additional reception support has been arranged for peak times to reduce stress on staff.'
)
ON CONFLICT (complaint_reference) DO NOTHING;