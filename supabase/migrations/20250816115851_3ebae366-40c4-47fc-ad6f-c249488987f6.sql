-- Force insert admin roles with explicit conflict resolution
-- First delete any existing conflicting rows
DELETE FROM public.user_roles WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';

-- Insert system_admin role
INSERT INTO public.user_roles (
  id,
  user_id, 
  role, 
  practice_id, 
  assigned_by,
  assigned_at,
  meeting_notes_access,
  gp_scribe_access,
  complaints_manager_access,
  enhanced_access,
  cqc_compliance_access,
  shared_drive_access,
  mic_test_service_access,
  api_testing_service_access
) VALUES (
  gen_random_uuid(),
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'system_admin',
  NULL,
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  now(),
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true
);

-- Insert practice_manager role
INSERT INTO public.user_roles (
  id,
  user_id, 
  role, 
  practice_id, 
  assigned_by,
  assigned_at,
  meeting_notes_access,
  gp_scribe_access,
  complaints_manager_access,
  enhanced_access,
  cqc_compliance_access,
  shared_drive_access,
  mic_test_service_access,
  api_testing_service_access
) VALUES (
  gen_random_uuid(),
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'practice_manager',
  'c800c954-3928-4a37-a5c4-c4ff3e680333',
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  now(),
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true
);

-- Verify the insert
SELECT * FROM public.user_roles WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';