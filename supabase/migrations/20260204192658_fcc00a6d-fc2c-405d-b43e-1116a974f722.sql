-- Update Well-Led domain elements with expanded guidance (Look For, CQC Expects, What Good Looks Like)

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Organisational structure chart showing clear lines of accountability, terms of reference for governance meetings (partners/board meetings), documented decision-making processes, risk register with named owners and review dates, evidence of regular governance reviews, and minutes showing oversight of key issues.

CQC EXPECTS: Clear governance arrangements that demonstrate accountability at all levels, with evidence that leaders understand their responsibilities. Inspectors will want to see that risks are identified, monitored and mitigated, and that there is appropriate oversight of clinical and operational performance.

WHAT GOOD LOOKS LIKE: A well-defined organisational structure that all staff understand, regular governance meetings with documented decisions and actions, an up-to-date risk register that is actively used to manage risks, and evidence that governance arrangements are reviewed and improved.'
WHERE domain = 'well_led' AND element_key = 'W1';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Training needs analysis linked to role requirements, training matrix showing all staff with completion dates and due dates, annual appraisal records for every staff member, personal development plans (PDPs) with SMART objectives, evidence of mandatory training compliance (safeguarding, BLS, fire safety, IG), and protected time for training.

CQC EXPECTS: All staff to have received an appraisal within the last 12 months, mandatory training to be up to date, training needs to be identified and addressed, and staff to have development opportunities. Inspectors may ask staff about their training and whether they feel supported to develop.

WHAT GOOD LOOKS LIKE: 100% appraisal compliance, a culture where training is valued and prioritised, staff who can articulate their development goals, evidence that training has improved practice, and a systematic approach to identifying and addressing training gaps.'
WHERE domain = 'well_led' AND element_key = 'W2';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Up-to-date complaints policy aligned with NHS complaints regulations, complaints log with dates, outcomes and response times, evidence of acknowledgement within 3 working days, evidence of learning and changes made, patient feedback mechanisms (FFT, surveys, comments), trend analysis and themed reports, and how learning is shared with staff.

CQC EXPECTS: A responsive and thorough complaints process, with evidence that complaints lead to improvements. Inspectors will want to see that patients are treated compassionately when they complain, responses are timely and thorough, and lessons are learned and shared across the organisation.

WHAT GOOD LOOKS LIKE: Low complaint numbers relative to practice size, timely and empathetic responses, clear evidence of changes made following complaints, staff who can describe recent learning from complaints, and regular reporting of complaint themes to governance meetings.'
WHERE domain = 'well_led' AND element_key = 'W3';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Current and completed QI projects with clear methodology (PDSA cycles), clinical audit programme with completed audits showing improvement, benchmarking against national/local data, patient survey results with action plans, evidence of staff involvement in improvement work, and QOF performance monitoring.

CQC EXPECTS: A culture of continuous improvement with evidence of completed improvement cycles that have led to better outcomes. Inspectors will want to see that the practice uses data to identify areas for improvement and can demonstrate the impact of improvement work.

WHAT GOOD LOOKS LIKE: Multiple ongoing QI projects, clinical audits that show improvement on re-audit, staff at all levels engaged in improvement, use of recognised QI methodology, patient involvement in improvement work, and evidence that improvement is embedded in daily practice.'
WHERE domain = 'well_led' AND element_key = 'W4';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Comprehensive BCP document covering IT failure, staff absence, premises issues and pandemic response, evidence of annual review and testing, contact trees and cascades, arrangements with neighbouring practices for mutual aid, prioritisation of essential services, and communication plans for patients and staff.

CQC EXPECTS: A tested and up-to-date business continuity plan that staff are aware of and can implement. Inspectors may ask staff what they would do in various emergency scenarios and whether the BCP has been activated recently.

WHAT GOOD LOOKS LIKE: A BCP that has been tested within the last 12 months, staff who know where to find the plan and their role in it, evidence of learning from any real incidents, arrangements that have been tested with partner organisations, and regular updates to contact details and procedures.'
WHERE domain = 'well_led' AND element_key = 'W5';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Data protection policy and procedures, evidence of annual IG training for all staff with toolkit completion, data sharing agreements with partner organisations, subject access request procedures and log, privacy notices displayed and on website, data breach procedure and incident log, Caldicott Guardian and SIRO identified, and secure disposal of confidential waste.

CQC EXPECTS: Compliance with GDPR and data protection legislation, with staff who understand their responsibilities for protecting patient information. Inspectors will check that the practice has appropriate technical and organisational measures to protect data.

WHAT GOOD LOOKS LIKE: 100% staff completion of IG training, no data breaches or quick identification and learning from any incidents, patients confident their data is protected, clear procedures that staff follow consistently, and regular IG audits with action on findings.'
WHERE domain = 'well_led' AND element_key = 'W6';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Staff survey results with response to feedback, wellbeing initiatives and support available, Freedom to Speak Up (FTSU) Guardian or equivalent arrangements, sickness absence monitoring and support for returning staff, evidence of staff recognition and celebration, exit interview data and themes, and staff workload monitoring.

CQC EXPECTS: Leaders who actively promote staff wellbeing and create a positive working culture. Inspectors will speak to staff to understand how they feel about working at the practice and whether they feel supported and valued.

WHAT GOOD LOOKS LIKE: High staff morale and low turnover, staff who feel comfortable raising concerns, visible wellbeing support and initiatives, leaders who are approachable and responsive to feedback, evidence that staff feedback has led to changes, and a culture of mutual respect and support.'
WHERE domain = 'well_led' AND element_key = 'W7';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Evidence of active PCN engagement and contribution, relationships with community services and voluntary sector, MDT meeting attendance records and outcomes, clear referral pathways to local services, collaborative working arrangements documented, engagement with ICB/CCG initiatives, and patient signposting to community resources.

CQC EXPECTS: Effective partnership working that improves patient outcomes and experience. Inspectors will want to see that the practice works collaboratively with others and contributes to system-wide improvements.

WHAT GOOD LOOKS LIKE: Strong relationships with PCN colleagues, active participation in local initiatives, innovative partnerships that benefit patients, staff who understand the local health and care landscape, and evidence that partnership working has improved care for patients.'
WHERE domain = 'well_led' AND element_key = 'W8';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Clear financial oversight arrangements, regular budget monitoring and reporting, evidence of contract compliance (GMS/PMS/APMS), procurement procedures showing value for money, partner/board review of financial performance, understanding of income streams and cost drivers, and planning for future financial sustainability.

CQC EXPECTS: Sound financial management that ensures the practice can continue to provide quality services. While CQC does not directly regulate finances, financial stability underpins safe and effective care.

WHAT GOOD LOOKS LIKE: Regular financial reporting to partners/board, understanding of the financial position across the leadership team, evidence of value for money in procurement decisions, forward financial planning, and no concerns about financial sustainability affecting care quality.'
WHERE domain = 'well_led' AND element_key = 'W9';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Current CQC registration certificate displayed, registered manager in post with appropriate experience, notification procedures documented and understood by staff, evidence of action on previous inspection report findings, understanding of legal requirements and regulated activities, and compliance with registration conditions.

CQC EXPECTS: Full compliance with CQC registration requirements, with a registered manager who understands their legal responsibilities. Inspectors will check that the practice meets all conditions of registration and notifies CQC of relevant events.

WHAT GOOD LOOKS LIKE: Up-to-date registration with no outstanding conditions, a registered manager who can articulate their responsibilities, evidence that previous recommendations have been acted upon, timely notifications to CQC when required, and a culture of compliance with regulatory requirements.'
WHERE domain = 'well_led' AND element_key = 'W10';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Comprehensive policy index with author, review dates and next review dates, version control system ensuring only current policies are in use, evidence of staff access to policies (shared drive, intranet), process for policy approval including clinical sign-off where appropriate, evidence that staff have read and understood key policies, and procedure for urgent policy updates.

CQC EXPECTS: Well-organised policies that are up to date, accessible to staff, and embedded in practice. Inspectors may check whether policies reflect current guidance and whether staff know where to find and how to apply them.

WHAT GOOD LOOKS LIKE: All policies reviewed within their review period, no out-of-date policies in circulation, staff who can quickly access policies they need, evidence that policy changes are communicated to staff, and a systematic approach to policy management.'
WHERE domain = 'well_led' AND element_key = 'W11';

UPDATE public.mock_inspection_element_templates 
SET evidence_guidance = 'LOOK FOR: Regular team meetings with agendas, minutes and action tracking, multiple communication channels (newsletters, noticeboards, email, messaging), open door policy and visible leadership, evidence of leadership walkabouts or clinical observation, staff awareness of practice vision, values and priorities, and cascade of important information to all staff including part-time.

CQC EXPECTS: Leaders who are visible, approachable and communicate effectively with their teams. Inspectors will ask staff about communication and whether they feel informed and connected to the leadership team.

WHAT GOOD LOOKS LIKE: Regular, productive team meetings that staff value, leaders who are visible and accessible, staff at all levels who feel informed about what is happening, a clear vision that staff can articulate, effective communication during times of change, and evidence that staff feedback influences decisions.'
WHERE domain = 'well_led' AND element_key = 'W12';