-- Clean up duplicate user roles and restore system admin
DELETE FROM public.user_roles 
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';

-- Insert the correct system_admin role with all permissions
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
);