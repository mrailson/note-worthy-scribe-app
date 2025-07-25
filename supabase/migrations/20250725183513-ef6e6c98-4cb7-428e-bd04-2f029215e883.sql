-- Insert 10 realistic complaints with full details using correct enum values
INSERT INTO public.complaints (
  patient_name, complaint_title, complaint_description, category, priority, status,
  incident_date, location_service, staff_mentioned, patient_contact_email, 
  patient_contact_phone, patient_address, consent_given, complaint_on_behalf,
  created_by, submitted_at, response_due_date
) VALUES 
(
  'Sarah Johnson',
  'Long waiting time and rude reception staff',
  'I arrived for my 2:30 PM appointment and was not seen until 4:15 PM. When I asked about the delay, the receptionist was dismissive and told me "that''s just how it is". This is unacceptable service, especially when I had to take time off work.',
  'waiting_times',
  'medium',
  'submitted',
  '2024-01-15',
  'Reception/Waiting Area',
  ARRAY['Jane Smith (Receptionist)'],
  'sarah.johnson@email.com',
  '07123456789',
  '123 Oak Street, Manchester, M1 1AA',
  true,
  false,
  '00000000-0000-0000-0000-000000000001',
  NOW() - INTERVAL '5 days',
  NOW() + INTERVAL '15 days'
),
(
  'Michael Brown',
  'Incorrect medication prescribed',
  'Dr. Williams prescribed me antibiotics for what I told him was a viral infection. I specifically mentioned I had been taking paracetamol and the symptoms were improving. The antibiotics caused severe stomach upset and were unnecessary.',
  'medication',
  'high',
  'investigating',
  '2024-01-10',
  'Consultation Room 2',
  ARRAY['Dr. Williams'],
  'michael.brown@email.com',
  '07987654321',
  '45 Elm Road, Manchester, M2 2BB',
  true,
  false,
  '00000000-0000-0000-0000-000000000002',
  NOW() - INTERVAL '8 days',
  NOW() + INTERVAL '12 days'
),
(
  'Emma Wilson',
  'Confidential information shared inappropriately',
  'During my appointment, I could hear the previous patient''s consultation through the thin walls. Later, I noticed my prescription details were left on the desk visible to other patients. This is a serious breach of confidentiality.',
  'communication',
  'high',
  'submitted',
  '2024-01-18',
  'Consultation Room 1',
  ARRAY['Dr. Patel'],
  'emma.wilson@email.com',
  '07456789123',
  '78 Pine Close, Manchester, M3 3CC',
  true,
  false,
  '00000000-0000-0000-0000-000000000003',
  NOW() - INTERVAL '3 days',
  NOW() + INTERVAL '17 days'
),
(
  'Robert Taylor',
  'Missed urgent referral causing delayed treatment',
  'I was told my urgent referral to cardiology would be processed within 2 weeks. After 6 weeks of no contact, I called to find the referral was never sent. This delay has caused me significant anxiety and potentially impacted my health.',
  'referrals',
  'high',
  'submitted',
  '2023-12-20',
  'GP Office',
  ARRAY['Dr. Smith', 'Admin Team'],
  'robert.taylor@email.com',
  '07234567890',
  '92 Maple Avenue, Manchester, M4 4DD',
  true,
  false,
  '00000000-0000-0000-0000-000000000004',
  NOW() - INTERVAL '10 days',
  NOW() + INTERVAL '10 days'
),
(
  'Lisa Thompson',
  'Unprofessional behavior from nurse during procedure',
  'During my blood test, the nurse was on her personal phone and seemed distracted. She had to attempt the blood draw three times, causing unnecessary pain and bruising. Her attitude was dismissive when I expressed concern.',
  'staff_attitude',
  'medium',
  'resolved',
  '2024-01-12',
  'Treatment Room',
  ARRAY['Nurse Collins'],
  'lisa.thompson@email.com',
  '07345678901',
  '156 Cedar Street, Manchester, M5 5EE',
  true,
  false,
  '00000000-0000-0000-0000-000000000005',
  NOW() - INTERVAL '12 days',
  NOW() - INTERVAL '2 days'
),
(
  'David Clark',
  'Appointment cancelled without sufficient notice',
  'My specialist appointment that I had been waiting 3 months for was cancelled by text message just 2 hours before the appointment time. No alternative was offered and I was told I''d have to wait another 8 weeks for a new slot.',
  'appointment_system',
  'medium',
  'investigating',
  '2024-01-20',
  'Appointment Booking',
  ARRAY['Booking Team'],
  'david.clark@email.com',
  '07567890123',
  '23 Birch Lane, Manchester, M6 6FF',
  true,
  false,
  '00000000-0000-0000-0000-000000000006',
  NOW() - INTERVAL '2 days',
  NOW() + INTERVAL '18 days'
),
(
  'Jennifer Davis',
  'Lack of disabled access and poor treatment',
  'As a wheelchair user, I found the practice very difficult to navigate. The accessible toilet was being used for storage, and staff seemed inconvenienced by my needs. I felt discriminated against and unwelcome.',
  'facilities',
  'high',
  'submitted',
  '2024-01-16',
  'Main Practice Building',
  ARRAY['Reception Staff'],
  'jennifer.davis@email.com',
  '07678901234',
  '67 Ash Grove, Manchester, M7 7GG',
  true,
  false,
  '00000000-0000-0000-0000-000000000007',
  NOW() - INTERVAL '4 days',
  NOW() + INTERVAL '16 days'
),
(
  'Mark Anderson',
  'Billing error and poor customer service',
  'I was incorrectly charged £85 for a private consultation that should have been NHS. When I called to resolve this, I was passed between 4 different people and told conflicting information. The issue remains unresolved after 2 weeks.',
  'billing',
  'medium',
  'investigating',
  '2024-01-08',
  'Billing Department',
  ARRAY['Finance Team'],
  'mark.anderson@email.com',
  '07789012345',
  '34 Willow Road, Manchester, M8 8HH',
  true,
  false,
  '00000000-0000-0000-0000-000000000008',
  NOW() - INTERVAL '7 days',
  NOW() + INTERVAL '13 days'
),
(
  'Helen Garcia',
  'Prescription error nearly caused allergic reaction',
  'Despite my allergy to penicillin being clearly marked in my records, I was prescribed amoxicillin. Fortunately, I double-checked before taking it. This could have been life-threatening and shows a serious lack of attention to patient safety.',
  'medication',
  'high',
  'submitted',
  '2024-01-14',
  'Pharmacy/Prescription',
  ARRAY['Dr. Jones', 'Pharmacist'],
  'helen.garcia@email.com',
  '07890123456',
  '89 Hazel Close, Manchester, M9 9II',
  true,
  false,
  '00000000-0000-0000-0000-000000000009',
  NOW() - INTERVAL '6 days',
  NOW() + INTERVAL '14 days'
),
(
  'James Rodriguez',
  'Inadequate pain management and dismissive attitude',
  'I have been suffering from chronic back pain for months. Dr. Thompson dismissed my concerns, saying it was "just muscle strain" without proper examination. I requested stronger pain relief or specialist referral but was refused both.',
  'clinical_care',
  'medium',
  'submitted',
  '2024-01-11',
  'Consultation Room 3',
  ARRAY['Dr. Thompson'],
  'james.rodriguez@email.com',
  '07901234567',
  '145 Oak Park, Manchester, M10 0JJ',
  true,
  false,
  '00000000-0000-0000-0000-000000000010',
  NOW() - INTERVAL '9 days',
  NOW() + INTERVAL '11 days'
);

-- Add realistic feedback notes from GP, reception team, and management
INSERT INTO public.complaint_notes (complaint_id, note, created_by, is_internal) 
SELECT c.id, 
CASE 
  WHEN c.patient_name = 'Sarah Johnson' THEN 'Initial review: Patient waited 1h 45m due to emergency appointment. Reception staff member Jane Smith was spoken to about customer service approach. Additional training scheduled.'
  WHEN c.patient_name = 'Michael Brown' THEN 'Clinical review completed. Dr. Williams confirms diagnosis was appropriate based on symptoms presented. Patient may have misremembered details of consultation. Following up with patient to clarify.'
  WHEN c.patient_name = 'Emma Wilson' THEN 'Serious concern raised. Room soundproofing to be reviewed. Staff reminded of confidentiality protocols. Desk procedures updated to prevent document exposure.'
  WHEN c.patient_name = 'Robert Taylor' THEN 'Admin error confirmed. Referral was prepared but not submitted due to system glitch. Patient now fast-tracked for urgent cardiology appointment. Process review underway.'
  WHEN c.patient_name = 'Lisa Thompson' THEN 'Nurse Collins has been spoken to. Personal phone use during procedures is unacceptable. Patient offered compensation for additional discomfort. Refresher training completed.'
  WHEN c.patient_name = 'David Clark' THEN 'Emergency clinic closure due to heating failure. Short notice unavoidable but communication could have been better. Patient offered priority rebooking.'
  WHEN c.patient_name = 'Jennifer Davis' THEN 'Disability access audit scheduled. Storage items removed from accessible toilet immediately. Staff training on disability awareness arranged for all team.'
  WHEN c.patient_name = 'Mark Anderson' THEN 'Billing error confirmed - system incorrectly flagged as private due to consultant involvement. Full refund processed. System update to prevent recurrence.'
  WHEN c.patient_name = 'Helen Garcia' THEN 'Critical incident review initiated. Allergy alerts to be made more prominent in system. Additional safety check implemented for all prescriptions.'
  WHEN c.patient_name = 'James Rodriguez' THEN 'Clinical assessment appropriate but communication could be improved. Patient offered second opinion and physiotherapy referral. Dr. Thompson to attend communication course.'
END,
'00000000-0000-0000-0000-000000000001',
true
FROM complaints c
WHERE c.patient_name IN ('Sarah Johnson', 'Michael Brown', 'Emma Wilson', 'Robert Taylor', 'Lisa Thompson', 'David Clark', 'Jennifer Davis', 'Mark Anderson', 'Helen Garcia', 'James Rodriguez');

-- Add follow-up notes from different team members
INSERT INTO public.complaint_notes (complaint_id, note, created_by, is_internal)
SELECT c.id,
CASE 
  WHEN c.patient_name = 'Sarah Johnson' THEN 'Reception Manager follow-up: Jane Smith has completed customer service training. New triage system implemented to better manage waiting times during busy periods.'
  WHEN c.patient_name = 'Robert Taylor' THEN 'Practice Manager update: New referral tracking system implemented. All staff trained on escalation procedures for urgent referrals. Patient satisfaction survey to follow.'
  WHEN c.patient_name = 'Lisa Thompson' THEN 'Nursing Lead response: Incident used as case study in team meeting. All nursing staff reminded of professional standards. Personal device policy clarified and reinforced.'
  WHEN c.patient_name = 'Jennifer Davis' THEN 'Facilities Manager report: Accessibility improvements ordered including better signage and staff awareness training. Full compliance review scheduled quarterly.'
  WHEN c.patient_name = 'Helen Garcia' THEN 'Clinical Lead review: Near-miss incident reported to CCG. Allergy checking protocol strengthened. Monthly medication safety audits now mandatory.'
END,
'00000000-0000-0000-0000-000000000002',
true
FROM complaints c
WHERE c.patient_name IN ('Sarah Johnson', 'Robert Taylor', 'Lisa Thompson', 'Jennifer Davis', 'Helen Garcia');

-- Add responses that would be sent to patients (non-internal notes)
INSERT INTO public.complaint_notes (complaint_id, note, created_by, is_internal)
SELECT c.id,
CASE 
  WHEN c.patient_name = 'Lisa Thompson' AND c.status = 'resolved' THEN 'Dear Ms Thompson, We sincerely apologize for the unprofessional service you received. The staff member has been retrained and we have implemented new procedures. We would welcome you back and ensure this does not happen again.'
END,
'00000000-0000-0000-0000-000000000001',
false
FROM complaints c
WHERE c.patient_name = 'Lisa Thompson' AND c.status = 'resolved';