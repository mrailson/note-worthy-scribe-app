-- Create missing profile for Katherine Deaville
INSERT INTO public.profiles (user_id, full_name, email, role)
VALUES (
  '4001a118-6063-4a9f-b622-6666409ee086',
  'Katherine Deaville',
  'katherinedeaville@nhs.net',
  'practice_manager'
)
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- Create missing user_roles for Katherine Deaville with The Long Buckby Practice
INSERT INTO public.user_roles (
  user_id, practice_id, role, practice_role, meeting_notes_access,
  complaints_manager_access, translation_service_access, survey_manager_access,
  gp_scribe_access, enhanced_access, cqc_compliance_access,
  shared_drive_access, mic_test_service_access, api_testing_service_access,
  document_signoff_access
)
VALUES (
  '4001a118-6063-4a9f-b622-6666409ee086',
  'ba0713f5-5d56-401b-8974-fb3c4c340006',
  'practice_manager',
  'practice_manager',
  true, true, true, true, false, false, true, false, false, false, false
)
ON CONFLICT DO NOTHING;