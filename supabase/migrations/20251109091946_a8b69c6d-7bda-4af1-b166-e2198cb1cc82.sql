-- Shorten all complaint demo response quick load answers (at least 50% shorter, remove formatting)

UPDATE complaint_demo_responses SET
  key_findings = 'Referral delayed 12 days due to incorrect tray placement.',
  actions_taken = 'Referral processed, patient apologised to.',
  improvements_made = 'New tray labels and daily referral audits.',
  additional_context = 'Weekly spot-checks on processing times.'
WHERE complaint_reference = 'COMP250001';

UPDATE complaint_demo_responses SET
  key_findings = 'GP consultation rushed, patient concerns not adequately addressed.',
  actions_taken = 'GP reflective practice completed.',
  improvements_made = 'Communication training and feedback system.',
  additional_context = 'Quarterly consultation time monitoring.'
WHERE complaint_reference = 'COMP250002';

UPDATE complaint_demo_responses SET
  key_findings = 'Records accessed inappropriately, data protection breach.',
  actions_taken = 'Staff disciplined, ICO notified.',
  improvements_made = 'Mandatory refresher training.',
  additional_context = 'Enhanced access logging system.'
WHERE complaint_reference = 'COMP250003';

UPDATE complaint_demo_responses SET
  key_findings = 'Test results not communicated to patient.',
  actions_taken = 'Patient contacted with apology.',
  improvements_made = 'Double-check protocol for abnormal results.',
  additional_context = 'Weekly results communication checks.'
WHERE complaint_reference = 'COMP250004';

UPDATE complaint_demo_responses SET
  key_findings = 'System failure caused double-booking, 90 minute wait.',
  actions_taken = 'System bug fixed, patients rebooked.',
  improvements_made = 'System upgraded with buffer slots.',
  additional_context = 'Real-time monitoring dashboard.'
WHERE complaint_reference = 'COMP250005';

UPDATE complaint_demo_responses SET
  key_findings = 'Wrong medication issued due to similar names.',
  actions_taken = 'Correct prescription issued immediately.',
  improvements_made = 'Computer alerts for sound-alike drugs.',
  additional_context = 'Monthly medication safety audits.'
WHERE complaint_reference = 'COMP250006';

UPDATE complaint_demo_responses SET
  key_findings = 'Delayed diagnosis, symptoms not escalated.',
  actions_taken = 'Urgent specialist referral arranged.',
  improvements_made = 'Enhanced triage training.',
  additional_context = 'Monthly delayed diagnosis reviews.'
WHERE complaint_reference = 'COMP250007';

UPDATE complaint_demo_responses SET
  key_findings = 'Confidential information discussed within earshot.',
  actions_taken = 'Staff counselled, patient apologised to.',
  improvements_made = 'Soundproofing and privacy screens installed.',
  additional_context = 'Mystery shopper confidentiality checks.'
WHERE complaint_reference = 'COMP250008';

UPDATE complaint_demo_responses SET
  key_findings = 'Home visit not conducted, no notification sent.',
  actions_taken = 'Emergency visit arranged same day.',
  improvements_made = 'Visit confirmation protocol implemented.',
  additional_context = 'Patient SMS notifications.'
WHERE complaint_reference = 'COMP250009';

UPDATE complaint_demo_responses SET
  key_findings = 'Receptionist rude when patient called about urgent concern.',
  actions_taken = 'Receptionist retrained, patient apologised to.',
  improvements_made = 'Customer service standards refreshed.',
  additional_context = 'Monthly service reviews.'
WHERE complaint_reference = 'COMP250010';

UPDATE complaint_demo_responses SET
  key_findings = 'Inappropriate treatment plan, patient concerns dismissed.',
  actions_taken = 'Treatment plan revised, second opinion arranged.',
  improvements_made = 'Clinical review process enhanced.',
  additional_context = 'Monthly clinical audit meetings.'
WHERE complaint_reference = 'COMP250011';

UPDATE complaint_demo_responses SET
  key_findings = 'Vaccination reminder not sent, patient missed appointment.',
  actions_taken = 'Appointment rescheduled, system checked.',
  improvements_made = 'Automated reminder system fixed.',
  additional_context = 'Daily reminder system monitoring.'
WHERE complaint_reference = 'COMP250012';

UPDATE complaint_demo_responses SET
  key_findings = 'Repeat prescription delayed, patient ran out.',
  actions_taken = 'Emergency prescription issued.',
  improvements_made = 'Automated prescription tracking.',
  additional_context = 'Real-time stock alerts.'
WHERE complaint_reference = 'COMP250013';

UPDATE complaint_demo_responses SET
  key_findings = 'Phone lines constantly engaged, patient unable to book.',
  actions_taken = 'Additional phone lines installed.',
  improvements_made = 'Online booking system implemented.',
  additional_context = 'Call waiting times monitored.'
WHERE complaint_reference = 'COMP250014';

UPDATE complaint_demo_responses SET
  key_findings = 'Medical report inaccurate, insurance claim affected.',
  actions_taken = 'Corrected report issued, patient compensated.',
  improvements_made = 'Peer review for all reports.',
  additional_context = 'Quality assurance checks.'
WHERE complaint_reference = 'COMP250015';

UPDATE complaint_demo_responses SET
  key_findings = 'Child safeguarding concern not escalated properly.',
  actions_taken = 'Social services notified, staff training reviewed.',
  improvements_made = 'Safeguarding policy updated.',
  additional_context = 'Designated safeguarding lead appointed.'
WHERE complaint_reference = 'COMP250016';

UPDATE complaint_demo_responses SET
  key_findings = 'Chaperone not offered during intimate examination.',
  actions_taken = 'Apology issued, policy reviewed.',
  improvements_made = 'Mandatory chaperone policy implemented.',
  additional_context = 'Staff awareness sessions.'
WHERE complaint_reference = 'COMP250017';

UPDATE complaint_demo_responses SET
  key_findings = 'Pathology sample lost, test had to be repeated.',
  actions_taken = 'Test repeated at no cost, courier investigated.',
  improvements_made = 'Barcode tracking for all samples.',
  additional_context = 'Chain of custody procedures.'
WHERE complaint_reference = 'COMP250018';

UPDATE complaint_demo_responses SET
  key_findings = 'Wheelchair access blocked, disabled patient turned away.',
  actions_taken = 'Access cleared, patient rebooked.',
  improvements_made = 'Disability awareness training.',
  additional_context = 'Daily access audits.'
WHERE complaint_reference = 'COMP250019';

UPDATE complaint_demo_responses SET
  key_findings = 'Mental health crisis not recognised by duty doctor.',
  actions_taken = 'Crisis team contacted, patient supported.',
  improvements_made = 'Mental health first aid training.',
  additional_context = 'Partnership with crisis team.'
WHERE complaint_reference = 'COMP250020';

UPDATE complaint_demo_responses SET
  key_findings = 'DNR order not followed during emergency.',
  actions_taken = 'Family supported, incident reviewed.',
  improvements_made = 'End of life care training.',
  additional_context = 'Electronic care plans.'
WHERE complaint_reference = 'COMP250021';

UPDATE complaint_demo_responses SET
  key_findings = 'Interpreter not arranged, patient misunderstood treatment.',
  actions_taken = 'Interpreter provided, treatment explained.',
  improvements_made = 'Interpreter booking protocol.',
  additional_context = 'Language needs flagged on records.'
WHERE complaint_reference = 'COMP250022';

UPDATE complaint_demo_responses SET
  key_findings = 'Blood test results sent to wrong patient.',
  actions_taken = 'Both patients contacted, ICO notified.',
  improvements_made = 'Results verification process.',
  additional_context = 'Double-check protocol.'
WHERE complaint_reference = 'COMP250023';

UPDATE complaint_demo_responses SET
  key_findings = 'Cancelled surgery, patient not informed for 3 days.',
  actions_taken = 'Alternative date arranged, apology issued.',
  improvements_made = 'Real-time patient notification system.',
  additional_context = 'Automated SMS alerts.'
WHERE complaint_reference = 'COMP250024';

UPDATE complaint_demo_responses SET
  key_findings = 'Nursing home resident medication round missed.',
  actions_taken = 'Medication administered, family informed.',
  improvements_made = 'Electronic medication round tracker.',
  additional_context = 'Daily care home liaison.'
WHERE complaint_reference = 'COMP250025';

UPDATE complaint_demo_responses SET
  key_findings = 'Patient charged for NHS service.',
  actions_taken = 'Refund issued, billing system corrected.',
  improvements_made = 'NHS exemption checking process.',
  additional_context = 'Monthly billing audits.'
WHERE complaint_reference = 'COMP250026';

UPDATE complaint_demo_responses SET
  key_findings = 'Allergies not checked before prescribing.',
  actions_taken = 'Alternative medication prescribed.',
  improvements_made = 'Mandatory allergy verification.',
  additional_context = 'System pop-up alerts.'
WHERE complaint_reference = 'COMP250027';

UPDATE complaint_demo_responses SET
  key_findings = 'GP refused home visit for bedbound patient.',
  actions_taken = 'Visit conducted, GP counselled.',
  improvements_made = 'Home visit criteria clarified.',
  additional_context = 'Visit request review process.'
WHERE complaint_reference = 'COMP250028';

UPDATE complaint_demo_responses SET
  key_findings = 'Patient notes discussed in public area.',
  actions_taken = 'Staff reminded of confidentiality.',
  improvements_made = 'Designated clinical discussion areas.',
  additional_context = 'Privacy awareness training.'
WHERE complaint_reference = 'COMP250029';

UPDATE complaint_demo_responses SET
  key_findings = 'Emergency contraception request delayed 48 hours.',
  actions_taken = 'Prescription issued urgently.',
  improvements_made = 'Same-day emergency prescription protocol.',
  additional_context = 'Triage priority for time-sensitive requests.'
WHERE complaint_reference = 'COMP250030';