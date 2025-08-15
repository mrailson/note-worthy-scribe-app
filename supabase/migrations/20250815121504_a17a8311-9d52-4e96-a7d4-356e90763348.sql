-- Update the system admin role to have all access permissions
UPDATE public.user_roles 
SET 
  enhanced_access = true,
  api_testing_service_access = true,
  meeting_notes_access = true,
  gp_scribe_access = true,
  complaints_manager_access = true,
  ai_4_pm_access = true,
  cqc_compliance_access = true,
  shared_drive_access = true,
  mic_test_service_access = true,
  replywell_access = true,
  complaints_admin_access = true
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' 
AND role = 'system_admin';