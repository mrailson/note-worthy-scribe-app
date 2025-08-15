-- Clean up duplicate user roles and restore system admin
DELETE FROM public.user_roles 
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' 
AND role = 'user';

-- Insert the correct system_admin role
INSERT INTO public.user_roles (
  user_id, 
  role, 
  assigned_by,
  meeting_notes_access,
  gp_scribe_access,
  complaints_manager_access,
  enhanced_access,
  cqc_compliance_access,
  shared_drive_access,
  mic_test_service_access,
  api_testing_service_access,
  ai_4_pm_access,
  replywell_access,
  complaints_admin_access
) VALUES (
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'system_admin',
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true
) ON CONFLICT (user_id, role) DO UPDATE SET
  meeting_notes_access = true,
  gp_scribe_access = true,
  complaints_manager_access = true,
  enhanced_access = true,
  cqc_compliance_access = true,
  shared_drive_access = true,
  mic_test_service_access = true,
  api_testing_service_access = true,
  ai_4_pm_access = true,
  replywell_access = true,
  complaints_admin_access = true;