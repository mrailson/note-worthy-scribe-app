-- Update Safe domain elements with enhanced CQC-aligned guidance

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Up-to-date safeguarding policy (adults and children), named safeguarding lead with contact details displayed, staff training records showing Level 3 for clinical staff and Level 2 for non-clinical, DBS check register with renewal tracking, safeguarding referral log with outcomes tracked, MARAC/MAPPA awareness, FGM mandatory reporting procedures, Prevent training evidence.

CQC EXPECTS: Clear escalation pathways, evidence of acting on concerns promptly, regular policy reviews (annual minimum), safeguarding discussions in team meetings, and staff able to articulate what they would do if they had a concern. Inspectors may ask about specific cases and how learning was shared.

WHAT GOOD LOOKS LIKE: Named lead actively engaged, whole-team awareness, clear documentation of referrals and outcomes, evidence of multi-agency working, and proactive identification of vulnerable patients.'
WHERE element_key = 'S1' AND domain = 'safe';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Comprehensive IPC policy, hand hygiene audit results (target >95%), cleaning schedules with daily sign-off, PPE stock and training records, sharps injury log, staff immunisation records (Hep B, MMR, flu), IPC link nurse/lead identified, clinical waste disposal contracts, decontamination procedures for equipment.

CQC EXPECTS: Visible cleanliness in all areas, staff demonstrating good hand hygiene technique, appropriate use of PPE, evidence of IPC audits with action plans, outbreak management procedures, and compliance with HTM 01-05 for decontamination. Clinical areas should be clutter-free.

WHAT GOOD LOOKS LIKE: Regular IPC audits with improving trends, staff champions, evidence of learning from incidents, visible IPC reminders, and a culture where staff feel able to challenge poor practice.'
WHERE element_key = 'S2' AND domain = 'safe';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Medicines management policy, controlled drugs (CD) register with two-signature checks and running balances, vaccine fridge temperature logs (2-8°C with twice-daily recording), prescription pad security log, repeat prescribing protocols, high-risk medicines monitoring (DMARDs, lithium, anticoagulants), EPS security, emergency drug box with expiry checks.

CQC EXPECTS: No gaps in CD register, fridge temperatures always in range with evidence of action when not, secure storage of all medicines, clear protocols for high-risk prescribing, regular medicines audits, and patient group directions (PGDs) properly authorised and in date.

WHAT GOOD LOOKS LIKE: Robust checking systems, pharmacist involvement in audits, clear accountability, evidence of learning from prescribing errors, and proactive monitoring of patients on high-risk medicines.'
WHERE element_key = 'S3' AND domain = 'safe';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Complete equipment inventory with locations, PAT testing certificates (annual for portable electrical), calibration records for BP monitors/thermometers/peak flow meters/glucometers (as per manufacturer guidance), maintenance contracts for larger equipment, training records for equipment use, procedure for reporting faults, single-use equipment policy.

CQC EXPECTS: All equipment in use to be safe, maintained and calibrated, staff trained in equipment use, clear process for removing faulty equipment from service, evidence of acting on manufacturer safety notices, and resuscitation equipment checked daily.

WHAT GOOD LOOKS LIKE: Up-to-date asset register, no expired calibrations, clear ownership of equipment management, evidence of regular checks, and staff confident in equipment use.'
WHERE element_key = 'S4' AND domain = 'safe';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Recruitment policy with safer recruitment principles, DBS check register showing renewal every 3 years, references on file (minimum 2 including most recent employer), professional registration checks (GMC/NMC/GPhC with renewal dates), proof of right to work, photographic ID verification, full employment history with gap explanations, induction checklist completed.

CQC EXPECTS: No staff working without completed checks, evidence of acting on concerns from references, ongoing monitoring of professional registrations, locum/agency staff verification, and Disclosure and Barring Service updates service utilisation where applicable.

WHAT GOOD LOOKS LIKE: Comprehensive pre-employment checks with audit trail, no gaps in verification, ongoing monitoring systems, and clear accountability for recruitment compliance.'
WHERE element_key = 'S5' AND domain = 'safe';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: General H&S policy and risk assessment (reviewed annually), COSHH assessments for all hazardous substances, lone working policy with risk assessment and safety procedures, DSE assessments for computer users, manual handling assessments, stress risk assessments, new and expectant mothers risk assessments, young workers assessments if applicable.

CQC EXPECTS: Risk assessments to be specific to your practice (not generic templates), evidence of action taken to mitigate identified risks, staff awareness of risks relevant to their role, regular review and update of assessments, and incident reporting linked to risk assessment review.

WHAT GOOD LOOKS LIKE: Dynamic risk assessment process, staff involved in identifying risks, clear evidence of risk mitigation actions implemented, and learning from incidents feeding into risk assessment updates.'
WHERE element_key = 'S6' AND domain = 'safe';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Fire risk assessment by competent person (reviewed annually or after changes), fire evacuation plan with assembly point, fire drill records (minimum 6-monthly), fire extinguisher service certificates (annual), emergency lighting test records (monthly functional, annual duration), fire alarm test records (weekly), fire warden training, emergency contact procedures displayed.

CQC EXPECTS: All staff to know evacuation procedures, fire exits unobstructed, fire doors functioning correctly, evidence of acting on fire risk assessment recommendations, procedures for patients with mobility issues, and clear accountability for fire safety.

WHAT GOOD LOOKS LIKE: Regular drills with different scenarios, good staff knowledge, documented actions from risk assessments, visible fire safety information, and a culture of fire safety awareness.'
WHERE element_key = 'S7' AND domain = 'safe';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: SEA/significant event policy, log of all significant events with dates, completed SEA forms using structured format (what happened, why, what we learned, what we changed), action plans with named leads and deadlines, evidence of learning shared with whole team (meeting minutes), links to complaints and near-misses, duty of candour evidence where applicable.

CQC EXPECTS: Open culture where staff report events, timely investigation and learning, sharing of learning across the team, evidence of sustained change following SEAs, appropriate escalation of serious events, and patients informed when things go wrong (duty of candour).

WHAT GOOD LOOKS LIKE: No-blame culture, good reporting rates, evidence of systemic change, learning discussed in team meetings, themes identified and addressed, and improvement visible over time.'
WHERE element_key = 'S8' AND domain = 'safe';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: System for receiving MHRA alerts and CAS (Central Alerting System) notifications, named person responsible for acting on alerts, log of alerts received with actions taken, patient recall systems for affected medicines/devices, audit trail showing timely response, evidence of checking alerts against patient records.

CQC EXPECTS: All relevant alerts to be actioned promptly, clear process for identifying affected patients, evidence of patient contact where required, documentation of nil returns where no patients affected, and learning from alerts shared with clinical team.

WHAT GOOD LOOKS LIKE: Robust alert management system, prompt action with audit trail, regular review of alert types received, and integration with prescribing safety reviews.'
WHERE element_key = 'S9' AND domain = 'safe';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Chaperone policy (aligned with GMC/NMC guidance), list of trained chaperones with training dates, chaperone training records covering role and boundaries, signage in clinical areas offering chaperones, documentation in patient notes when chaperone offered/used/declined, DBS checks for all chaperones.

CQC EXPECTS: Chaperones offered for all intimate examinations, patient choice respected and documented, trained chaperones available at all times clinics run, clear understanding of chaperone role (observer not assistant), and appropriate gender options where possible.

WHAT GOOD LOOKS LIKE: Proactive offer documented consistently, sufficient trained staff, visible signage, patients aware of their rights, and regular audit of chaperone documentation.'
WHERE element_key = 'S10' AND domain = 'safe';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Clinical supervision policy, supervision records for nurses and HCAs showing regular sessions, mentoring arrangements for GP registrars/students, evidence of protected time for supervision, peer review processes, case discussion records, competency sign-off for extended roles.

CQC EXPECTS: All clinical staff to have appropriate supervision commensurate with their role and experience, evidence of developmental conversations, support for staff in extended roles, and clear escalation routes when staff need additional support.

WHAT GOOD LOOKS LIKE: Regular, documented supervision sessions, staff feeling supported, evidence of professional development discussions, and supervision feeding into training needs analysis.'
WHERE element_key = 'S11' AND domain = 'safe';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Premises risk assessment, security measures (CCTV where appropriate, access control, panic alarms), emergency lighting test records, legionella risk assessment with control measures and water temperature monitoring, asbestos register and management plan if applicable, regular building condition checks, disabled access assessment.

CQC EXPECTS: Safe and secure premises, appropriate security for staff and patients, compliance with building regulations, evidence of acting on identified risks, clear accountability for premises management, and accessibility for patients with disabilities.

WHAT GOOD LOOKS LIKE: Well-maintained premises, proactive maintenance programme, staff feeling safe, patients able to access services, and clear ownership of premises safety.'
WHERE element_key = 'S12' AND domain = 'safe';