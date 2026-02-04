-- Update Effective domain elements with expanded guidance

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Use of NICE guidelines and clinical pathways in practice, evidence that protocols are reviewed and updated regularly, staff awareness of current best practice, prescribing data aligned with formulary guidance, and evidence of clinical decision support tools.

CQC EXPECTS: Care and treatment to be delivered in line with current evidence-based guidance, standards and best practice. Inspectors will check that staff can access and apply relevant guidelines, and that there are systems to keep clinical practice up to date.

WHAT GOOD LOOKS LIKE: Clinical protocols that reference NICE and other authoritative sources, regular reviews triggered by new guidance, staff who can explain the evidence base for their practice, prescribing patterns that reflect best practice, and a culture of questioning and learning.'
WHERE domain = 'effective' AND element_key = 'E1';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Annual clinical audit plan linked to practice priorities, completed audits showing baseline data and re-audit results, QOF achievement data and actions on underperformance, prescribing audits, and evidence that audit findings lead to improvements.

CQC EXPECTS: A systematic approach to clinical audit that drives quality improvement. Inspectors will want to see completed audit cycles with evidence of improvement, not just data collection. They may ask how audit priorities are set and how findings are shared.

WHAT GOOD LOOKS LIKE: Audits that complete the full cycle (measure, change, re-measure), topics chosen based on risk and priority, all clinical staff involved in audit, clear evidence of improvements resulting from audit, and benchmarking against national or local data.'
WHERE domain = 'effective' AND element_key = 'E2';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Competency frameworks for nurses, HCAs and other clinical staff, documented competency assessments with dates, evidence of supervised practice for new skills, ongoing competency reviews linked to appraisal, and processes for addressing competency concerns.

CQC EXPECTS: Staff to work within their competence, with evidence that competencies are assessed and maintained. Inspectors may ask clinical staff about their scope of practice and how competencies were assessed. They will check that extended roles are appropriately supervised.

WHAT GOOD LOOKS LIKE: Clear competency frameworks for each clinical role, annual competency reviews, staff confident in their scope of practice, appropriate supervision for developing skills, and quick identification and support when competency concerns arise.'
WHERE domain = 'effective' AND element_key = 'E3';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Consent policy covering all types of consent, evidence of documented consent in clinical records, understanding of mental capacity requirements, Gillick competency considerations for under-16s, and processes for patients who lack capacity.

CQC EXPECTS: Valid consent to be obtained before care and treatment, with staff understanding legal requirements including the Mental Capacity Act. Inspectors will check clinical records for evidence of consent and may ask staff about consent processes for specific scenarios.

WHAT GOOD LOOKS LIKE: Consistent documentation of consent discussions, staff confident in assessing capacity, appropriate use of best interests decisions, clear processes for consent in different situations (minor procedures, vaccinations, LTC reviews), and regular training on consent and capacity.'
WHERE domain = 'effective' AND element_key = 'E4';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Regular MDT meetings with documented attendance and outcomes, shared care arrangements with secondary care, effective communication with community services, clear referral pathways, and evidence of collaborative working on complex cases.

CQC EXPECTS: Effective multidisciplinary working that benefits patients, with evidence of good communication between professionals. Inspectors will want to see that complex patients receive coordinated care and that the practice works well with external partners.

WHAT GOOD LOOKS LIKE: Regular, productive MDT meetings with good attendance, effective relationships with community nurses, mental health teams and social care, clear documentation of MDT discussions and actions, and patients who experience seamless care across services.'
WHERE domain = 'effective' AND element_key = 'E5';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Screening programme uptake data and improvement actions, immunisation rates for childhood and adult programmes, health promotion materials and campaigns, proactive identification of at-risk patients, NHS Health Checks delivery, and lifestyle support services.

CQC EXPECTS: A proactive approach to prevention and health promotion, with evidence of efforts to improve uptake of screening and immunisation. Inspectors will check vaccination and screening rates and ask how the practice promotes health and prevents illness.

WHAT GOOD LOOKS LIKE: Screening and immunisation rates above national/local averages, targeted work to improve uptake in underserved groups, active health promotion campaigns, Making Every Contact Count approach, and staff who can signpost to lifestyle services.'
WHERE domain = 'effective' AND element_key = 'E6';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Care plans for patients with long-term conditions, named GP arrangements for over-75s and patients in care homes, regular reviews documented in records, evidence of personalised care planning, and coordination for patients with complex needs.

CQC EXPECTS: Patients with complex needs or long-term conditions to have coordinated care with clear plans. Inspectors will look at how care is planned and whether patients are involved in decisions about their care. They may review records for evidence of care planning.

WHAT GOOD LOOKS LIKE: Up-to-date care plans that patients have contributed to, regular proactive reviews, effective use of care coordinators, patients who feel their care is joined up, and evidence that care plans are followed and updated.'
WHERE domain = 'effective' AND element_key = 'E7';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Use of clinical outcome data (QOF, referral rates, prescribing data), benchmarking against CCG/ICB averages and peer practices, evidence of acting on variation, patient-reported outcome measures, and mortality reviews if applicable.

CQC EXPECTS: Monitoring of patient outcomes with evidence that data is used to improve care. Inspectors will ask how the practice knows if its care is effective and what action is taken when outcomes could be better.

WHAT GOOD LOOKS LIKE: Regular review of outcome data at practice meetings, understanding of where practice sits compared to peers, targeted improvement work on areas of concern, use of patient-reported outcomes, and a culture of curiosity about clinical effectiveness.'
WHERE domain = 'effective' AND element_key = 'E8';

-- Update Caring domain elements with expanded guidance

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Privacy during consultations (doors closed, screens used appropriately), respectful communication observed and in records, patient feedback specifically about dignity, accessible facilities for patients with disabilities, and staff awareness of dignity in care.

CQC EXPECTS: Patients to be treated with kindness, respect, and dignity at all times. Inspectors will observe interactions, review patient feedback, and ask patients about their experiences. They will check that the environment supports dignified care.

WHAT GOOD LOOKS LIKE: Universally positive patient feedback about being treated with respect, staff who demonstrate warmth and courtesy in all interactions, an environment that protects privacy, attention to dignity for vulnerable patients, and a culture where dignity is non-negotiable.'
WHERE domain = 'caring' AND element_key = 'C1';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Evidence of shared decision-making in clinical records, patient information materials for common conditions and treatments, involvement in care planning documented, decision aids used where appropriate, and patient feedback on feeling involved in their care.

CQC EXPECTS: Patients to be active partners in decisions about their care and treatment, with access to information that helps them make informed choices. Inspectors will check records for evidence of patient involvement and may ask patients about their experiences.

WHAT GOOD LOOKS LIKE: Clinical records that show discussion of options with patients, high-quality patient information available, patients who feel listened to and involved, appropriate use of shared decision-making tools, and staff skilled in having these conversations.'
WHERE domain = 'caring' AND element_key = 'C2';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Patient testimonials and feedback about compassion, complaint themes related to compassion or lack thereof, staff awareness of compassionate care principles, evidence of going the extra mile for patients, and recognition of compassionate practice.

CQC EXPECTS: Care that is delivered with compassion and empathy, with staff who understand the impact of illness on patients and their families. Inspectors will observe interactions and look for evidence that compassion is embedded in the practice culture.

WHAT GOOD LOOKS LIKE: Consistently positive feedback about compassionate care, staff who show genuine concern for patients, examples of exceptional compassionate practice, low complaints about staff attitude, and leaders who model and recognise compassion.'
WHERE domain = 'caring' AND element_key = 'C3';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Signposting to mental health and emotional support services, counselling arrangements or referral pathways, staff training on recognising emotional distress, support for patients following bereavement or diagnosis, and quiet space available for distressed patients.

CQC EXPECTS: Staff to recognise and respond to patients emotional needs, with appropriate support available or signposting to services. Inspectors will ask about support for patients in distressing situations and check that staff feel equipped to provide emotional support.

WHAT GOOD LOOKS LIKE: Staff confident in recognising and responding to emotional distress, clear pathways to counselling and support services, patients who feel emotionally supported, follow-up for patients after difficult news, and a practice environment that feels supportive.'
WHERE domain = 'caring' AND element_key = 'C4';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Carers register with regular updates, carers health checks and flu vaccinations offered, signposting to carers support services and assessments, flexible appointments for carers, staff awareness of carer needs, and involvement of carers in care planning where appropriate.

CQC EXPECTS: Carers to be identified, supported and involved in care where appropriate. Inspectors will check how carers are identified and what support is offered. They may ask about specific examples of carer support.

WHAT GOOD LOOKS LIKE: A comprehensive carers register that is actively maintained, proactive health support for carers, strong links with local carers organisations, carers who feel valued and supported by the practice, and staff who recognise the needs of carers.'
WHERE domain = 'caring' AND element_key = 'C5';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Friends and Family Test results displayed and trended over time, patient surveys with response rates and actions, suggestions box or other feedback mechanisms, evidence of changes made in response to feedback, and how feedback reaches all staff.

CQC EXPECTS: Active collection of patient feedback with evidence that it is used to improve services. Inspectors will review feedback data and ask how the practice responds to what patients say. They will look for evidence of changes made following feedback.

WHAT GOOD LOOKS LIKE: High FFT response rates with positive scores, regular patient surveys with good response rates, clear evidence of "you said, we did" improvements, feedback discussed at practice meetings, and a culture of welcoming and acting on patient views.'
WHERE domain = 'caring' AND element_key = 'C6';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Private areas for sensitive discussions, reception desk design and conversation audibility, computer screen positioning away from patient view, confidential waste procedures, staff training on confidentiality, and clear signage about confidentiality.

CQC EXPECTS: Patient confidentiality to be protected in all interactions, with an environment and processes that support confidential care. Inspectors will observe the physical environment and may ask patients about their experience of confidentiality.

WHAT GOOD LOOKS LIKE: An environment designed with confidentiality in mind, patients confident their information is protected, staff who are vigilant about confidentiality, private rooms available for sensitive discussions, and consistent adherence to confidentiality procedures.'
WHERE domain = 'caring' AND element_key = 'C7';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Interpreter services available and used appropriately, cultural awareness training for staff, accommodations for religious or cultural requirements, diverse patient materials, staff awareness of health beliefs in different communities, and accessibility for patients with different needs.

CQC EXPECTS: Services that are accessible and sensitive to the needs of diverse communities. Inspectors will ask how the practice meets the needs of patients from different backgrounds and may check that interpreter services are available and used.

WHAT GOOD LOOKS LIKE: Proactive use of professional interpreters (not family members for clinical discussions), staff confident in meeting diverse cultural needs, patient materials in relevant languages, understanding of health beliefs in local communities, and feedback from diverse patient groups.'
WHERE domain = 'caring' AND element_key = 'C8';

-- Sync existing session elements with updated templates for Effective and Caring domains
UPDATE public.mock_inspection_elements 
SET evidence_guidance = t.evidence_guidance
FROM public.mock_inspection_element_templates t
WHERE mock_inspection_elements.domain = t.domain 
  AND mock_inspection_elements.element_key = t.element_key
  AND mock_inspection_elements.domain IN ('effective', 'caring');