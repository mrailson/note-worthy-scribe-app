
-- Delete orphaned and incorrect demo responses
DELETE FROM public.complaint_demo_responses 
WHERE complaint_reference IN (
  'COMP250001', 'COMP250002', 'COMP250003', 'COMP250004', 'COMP250005', 'COMP250006',
  'COMP250015', 'COMP250016', 'COMP250017', 'COMP250018', 'COMP250019', 'COMP250020'
);

-- Update COMP250007: Misdiagnosis of Chest Pain (Robert Mitchell)
INSERT INTO public.complaint_demo_responses (complaint_reference, key_findings, actions_taken, improvements_made, additional_context)
VALUES (
  'COMP250007',
  'Dr. Anderson did not perform physical examination, ECG, or cardiovascular risk assessment despite clear red-flag symptoms (chest pain, left arm radiation, family history). Documentation shows "muscular pain" diagnosis based on verbal history alone.',
  'Dr. Anderson immediately completed refresher training on acute chest pain assessment; Formal apology issued to Mr. Mitchell; Case underwent full significant event analysis; Clinical supervisor reviewed all recent consultations by Dr. Anderson.',
  'Implemented mandatory ECG protocol for all chest pain presentations; Introduced cardiovascular risk assessment checklist; All GPs completed acute coronary syndrome training; Chest pain now flagged as automatic safety-netting requirement.',
  'Practice now has clear red-flag symptom guidance displayed in all consulting rooms. Monthly clinical audit of chest pain presentations introduced. Patient safety incident formally reported and learned from.'
)
ON CONFLICT (complaint_reference) 
DO UPDATE SET
  key_findings = EXCLUDED.key_findings,
  actions_taken = EXCLUDED.actions_taken,
  improvements_made = EXCLUDED.improvements_made,
  additional_context = EXCLUDED.additional_context;

-- Update COMP250008: Incorrect Medical Records (Christopher Baker)
INSERT INTO public.complaint_demo_responses (complaint_reference, key_findings, actions_taken, improvements_made, additional_context)
VALUES (
  'COMP250008',
  'Investigation confirmed three separate record errors: incorrect address on system since 2023, test results belonging to Sarah Baker filed in Christopher Baker''s record on 15th September, and missing consultation notes from July visit. Record amendment requests not actioned within practice policy timeframe.',
  'All three errors immediately corrected and verified; Full audit of all "Baker" surname records completed; Practice manager personally contacted Mr. Baker to apologise and confirm corrections; Staff member responsible received additional training on record management and data protection.',
  'Implemented weekly data quality audit; Introduced electronic verification system requiring patient confirmation of address at each visit; Enhanced staff training on GDPR and data accuracy; Established 48-hour target for record amendment requests.',
  'Practice now uses automated duplicate checking for similar names. Monthly data quality reports reviewed by practice manager. Patient portal implemented allowing patients to verify their own demographic data.'
)
ON CONFLICT (complaint_reference) 
DO UPDATE SET
  key_findings = EXCLUDED.key_findings,
  actions_taken = EXCLUDED.actions_taken,
  improvements_made = EXCLUDED.improvements_made,
  additional_context = EXCLUDED.additional_context;

-- Update COMP250009: Discrimination and Accessibility (Amara Okoye)
INSERT INTO public.complaint_demo_responses (complaint_reference, key_findings, actions_taken, improvements_made, additional_context)
VALUES (
  'COMP250009',
  'Accessible toilet was being used for storage on 12th October, breaching Equality Act requirements. Dr. Carter''s communication with Mrs. Okoye through her husband rather than directly demonstrates lack of awareness of disability etiquette and patient autonomy.',
  'Accessible toilet immediately cleared and remains permanently accessible; Dr. Carter received disability awareness training and issued personal apology to Mrs. Okoye; All clinical staff completed refresher training on equality and patient-centred communication; Full accessibility audit commissioned.',
  'Introduced daily checks of accessible facilities; Implemented "This is Me" patient preference recording system; All staff completed equality and diversity training; Added accessible appointment booking with specific requirements field; Designated accessibility champion appointed.',
  'Practice achieved Disability Confident Committed status. Regular consultation with local disability advocacy groups. Quarterly accessibility audits now standard. Patient feedback shows significant improvement in disability awareness.'
)
ON CONFLICT (complaint_reference) 
DO UPDATE SET
  key_findings = EXCLUDED.key_findings,
  actions_taken = EXCLUDED.actions_taken,
  improvements_made = EXCLUDED.improvements_made,
  additional_context = EXCLUDED.additional_context;

-- Update COMP250010, 11, 12: Safeguarding Failure (Joshua Turner) - same response for all three
INSERT INTO public.complaint_demo_responses (complaint_reference, key_findings, actions_taken, improvements_made, additional_context)
VALUES 
  ('COMP250010',
  'Dr. Hughes did not follow safeguarding protocol to speak to Joshua privately despite clear concerns raised about potential harm. Assessment of bruising documented as "normal" without adequate inquiry into circumstances or consideration of safeguarding indicators (unexplained bruising, behavioural change, specific concerns about household member).',
  'Dr. Hughes received immediate safeguarding refresher training and supervision; Formal apology issued to family; Case reviewed with designated safeguarding lead and reported to ICB safeguarding team as significant event; All GPs underwent safeguarding competency review.',
  'Implemented mandatory private consultation protocol for all children where harm suspected; Enhanced safeguarding flags in clinical system with automatic prompts; Weekly safeguarding supervision introduced for all clinicians; Safeguarding lead now reviews all child consultations with concerning features.',
  'Practice now has designated safeguarding consultation room. All clinical staff completed Level 3 child safeguarding training. Monthly safeguarding case discussion meetings introduced. Direct link established with local authority safeguarding team.'),
  ('COMP250011',
  'Dr. Hughes did not follow safeguarding protocol to speak to Joshua privately despite clear concerns raised about potential harm. Assessment of bruising documented as "normal" without adequate inquiry into circumstances or consideration of safeguarding indicators (unexplained bruising, behavioural change, specific concerns about household member).',
  'Dr. Hughes received immediate safeguarding refresher training and supervision; Formal apology issued to family; Case reviewed with designated safeguarding lead and reported to ICB safeguarding team as significant event; All GPs underwent safeguarding competency review.',
  'Implemented mandatory private consultation protocol for all children where harm suspected; Enhanced safeguarding flags in clinical system with automatic prompts; Weekly safeguarding supervision introduced for all clinicians; Safeguarding lead now reviews all child consultations with concerning features.',
  'Practice now has designated safeguarding consultation room. All clinical staff completed Level 3 child safeguarding training. Monthly safeguarding case discussion meetings introduced. Direct link established with local authority safeguarding team.'),
  ('COMP250012',
  'Dr. Hughes did not follow safeguarding protocol to speak to Joshua privately despite clear concerns raised about potential harm. Assessment of bruising documented as "normal" without adequate inquiry into circumstances or consideration of safeguarding indicators (unexplained bruising, behavioural change, specific concerns about household member).',
  'Dr. Hughes received immediate safeguarding refresher training and supervision; Formal apology issued to family; Case reviewed with designated safeguarding lead and reported to ICB safeguarding team as significant event; All GPs underwent safeguarding competency review.',
  'Implemented mandatory private consultation protocol for all children where harm suspected; Enhanced safeguarding flags in clinical system with automatic prompts; Weekly safeguarding supervision introduced for all clinicians; Safeguarding lead now reviews all child consultations with concerning features.',
  'Practice now has designated safeguarding consultation room. All clinical staff completed Level 3 child safeguarding training. Monthly safeguarding case discussion meetings introduced. Direct link established with local authority safeguarding team.')
ON CONFLICT (complaint_reference) 
DO UPDATE SET
  key_findings = EXCLUDED.key_findings,
  actions_taken = EXCLUDED.actions_taken,
  improvements_made = EXCLUDED.improvements_made,
  additional_context = EXCLUDED.additional_context;

-- Update COMP250013: Test Results Delay (Emma Richardson)
INSERT INTO public.complaint_demo_responses (complaint_reference, key_findings, actions_taken, improvements_made, additional_context)
VALUES (
  'COMP250013',
  'Blood test results received by practice on 10th October but not reviewed or communicated to patient until 27th October (17-day internal delay). Investigation revealed results were not flagged as abnormal in system due to filing error, and patient''s multiple phone calls were not escalated appropriately.',
  'Results immediately reviewed and patient contacted for urgent treatment; Formal apology and explanation provided; Staff member responsible for results management received additional training; Full audit of outstanding results conducted to identify any other delays.',
  'Implemented automated abnormal results flagging system; Introduced twice-daily results review protocol with named clinician responsibility; Patient results now tracked with 48-hour review target; SMS notification system for all results; Escalation process for patients who call about delayed results.',
  'Practice achieved 98% results review within 48 hours in subsequent monitoring. Weekly results management audit now standard. Pathology liaison improved with direct lab contact for urgent cases. Patient satisfaction with results communication improved significantly.'
)
ON CONFLICT (complaint_reference) 
DO UPDATE SET
  key_findings = EXCLUDED.key_findings,
  actions_taken = EXCLUDED.actions_taken,
  improvements_made = EXCLUDED.improvements_made,
  additional_context = EXCLUDED.additional_context;

-- Update COMP250014: Prescription Error (Michael Thompson)
INSERT INTO public.complaint_demo_responses (complaint_reference, key_findings, actions_taken, improvements_made, additional_context)
VALUES (
  'COMP250014',
  'Dr. Stevens prescribed ibuprofen to patient already taking aspirin and warfarin without checking current medication list or considering drug interaction risks. Clinical system drug interaction warning was overridden without documentation of clinical reasoning. Prescribing error identified by community pharmacist who refused to dispense.',
  'Dr. Stevens completed immediate prescribing safety review and received supervision; Formal apology issued to Mr. Thompson; Significant event analysis conducted; All prescribers underwent refresher training on polypharmacy and drug interactions; Dr. Stevens'' prescribing audited for three months.',
  'Implemented enhanced drug interaction alerts that require mandatory clinical justification to override; Introduced clinical pharmacist review of all repeat prescriptions for patients on multiple medications; Weekly prescribing safety meetings established; Polypharmacy patients now have structured medication reviews every 6 months.',
  'Practice now has dedicated clinical pharmacist conducting medication reviews. All prescribers completed advanced prescribing safety course. Drug interaction incidents reduced to zero in six-month monitoring period. Community pharmacy partnership strengthened for safety checks.'
)
ON CONFLICT (complaint_reference) 
DO UPDATE SET
  key_findings = EXCLUDED.key_findings,
  actions_taken = EXCLUDED.actions_taken,
  improvements_made = EXCLUDED.improvements_made,
  additional_context = EXCLUDED.additional_context;
