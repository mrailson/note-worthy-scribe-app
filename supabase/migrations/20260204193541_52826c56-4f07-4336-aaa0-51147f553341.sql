-- Update Responsive domain elements with expanded guidance

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Appointment availability data showing capacity vs demand, same-day urgent access arrangements, telephone access audits and answer times, online booking uptake, DNA rates and actions, extended hours or enhanced access provision, and patient feedback on access.

CQC EXPECTS: Patients to be able to access care and treatment in a timely way, with systems that meet their needs. Inspectors will review appointment data, check how urgent needs are met, and ask patients about their experience of getting appointments.

WHAT GOOD LOOKS LIKE: Appointments available when patients need them, multiple access channels (phone, online, walk-in), low DNA rates, positive patient feedback on access, proactive management of capacity, and evidence of continuous improvement in access.'
WHERE domain = 'responsive' AND element_key = 'R1';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Disability access audit and improvements, hearing loop available and working, easy-read materials for patients with learning disabilities, adjustments register for patients with specific needs, longer appointments available, and staff awareness of making reasonable adjustments.

CQC EXPECTS: Services to be accessible to all patients, with reasonable adjustments made for those with disabilities or specific needs. Inspectors will check the physical environment, ask about adjustments for specific patient groups, and may speak to patients with additional needs.

WHAT GOOD LOOKS LIKE: A comprehensive adjustments register that is actively used, staff confident in making adjustments, accessible premises, proactive identification of patients needing adjustments, Annual Health Checks for learning disability patients, and positive feedback from patients with additional needs.'
WHERE domain = 'responsive' AND element_key = 'R2';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Clear home visit criteria and request process, monitoring of home visit numbers and response times, appropriate prioritisation of urgent requests, equipment and safety arrangements for visiting, and feedback from housebound patients.

CQC EXPECTS: Appropriate home visit provision for patients who cannot attend the surgery, with clear criteria and timely responses. Inspectors will ask about the process for requesting and prioritising home visits and how housebound patients are cared for.

WHAT GOOD LOOKS LIKE: Clear criteria understood by reception staff, timely response to urgent home visit requests, proactive care for housebound patients including regular reviews, appropriate safety arrangements for visiting staff, and positive feedback from patients receiving home visits.'
WHERE domain = 'responsive' AND element_key = 'R3';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Clear out-of-hours information on website, in reception, and on answerphone message, patient awareness of OOH arrangements, effective handover to OOH provider, review of OOH reports received, and action on any concerns.

CQC EXPECTS: Patients to have clear information about accessing care outside normal hours, with effective communication between in-hours and out-of-hours services. Inspectors may check the answerphone message and website, and ask about handover arrangements.

WHAT GOOD LOOKS LIKE: Consistent, accurate OOH information across all channels, patients who know how to access care when the surgery is closed, systematic review of OOH contacts with follow-up where needed, good relationships with OOH provider, and learning from OOH activity.'
WHERE domain = 'responsive' AND element_key = 'R4';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Visible complaints procedure in waiting area and on website, multiple ways to complain (verbal, written, online), support for patients who need help making complaints, information about advocacy services, and staff awareness of how to receive complaints positively.

CQC EXPECTS: Patients to be able to raise concerns easily and feel confident they will be taken seriously. Inspectors will check how complaints can be made, whether information is accessible, and whether staff respond positively to concerns.

WHAT GOOD LOOKS LIKE: Complaints procedure that is easy to find and understand, staff who welcome feedback and handle initial concerns well, support for vulnerable patients making complaints, low barriers to raising concerns, and evidence that informal concerns are captured and addressed.'
WHERE domain = 'responsive' AND element_key = 'R5';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Real-time waiting time monitoring in waiting room, communication to patients about delays, actions taken to reduce waiting times, appointment length review, patient feedback on waiting, and evidence of improvement actions.

CQC EXPECTS: Patients to be kept informed about waiting times and for the practice to take action to minimise delays. Inspectors may observe the waiting room and ask patients about their experience of waiting.

WHAT GOOD LOOKS LIKE: Waiting times displayed or communicated to patients, apologies and explanations when delays occur, analysis of causes of delays with improvement actions, appropriate appointment lengths for different consultation types, and consistently positive feedback about waiting times.'
WHERE domain = 'responsive' AND element_key = 'R6';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Use of e-Referral Service (e-RS) with high booking rates, referral tracking system ensuring patients are not lost, communication with patients about referral status, Advice and Guidance usage, and monitoring of two-week wait referrals.

CQC EXPECTS: Effective referral processes that ensure patients access specialist care appropriately and are not lost in the system. Inspectors will check how referrals are made and tracked, particularly for urgent suspected cancer referrals.

WHAT GOOD LOOKS LIKE: High e-RS utilisation with good patient booking rates, systematic tracking of all referrals, patients informed about referral progress, effective use of Advice and Guidance to avoid unnecessary referrals, and robust processes for urgent cancer referrals.'
WHERE domain = 'responsive' AND element_key = 'R7';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Clear new patient registration process, timely registration and health checks for new patients, removals policy that is fair and proportionate, support for patients with challenging behaviours before considering removal, and documentation of removal decisions.

CQC EXPECTS: Fair and transparent patient list management, with appropriate support for patients before considering removal. Inspectors will review the removals policy and any recent removals to check they were handled appropriately.

WHAT GOOD LOOKS LIKE: Welcoming registration process with prompt new patient checks, very rare patient removals with documented support attempts first, no discrimination in registration decisions, appropriate management of challenging behaviour without rushing to removal, and clear appeals process.'
WHERE domain = 'responsive' AND element_key = 'R8';

-- Sync existing session elements with updated templates for Responsive domain
UPDATE public.mock_inspection_elements 
SET evidence_guidance = t.evidence_guidance
FROM public.mock_inspection_element_templates t
WHERE mock_inspection_elements.domain = t.domain 
  AND mock_inspection_elements.element_key = t.element_key
  AND mock_inspection_elements.domain = 'responsive';