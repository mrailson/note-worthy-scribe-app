-- Assign complaint CP202500001 to Oak Lane Medical Practice
UPDATE complaints 
SET practice_id = (
  SELECT id FROM gp_practices WHERE practice_code = 'K85999'
)
WHERE reference_number = 'CP202500001';

-- Ensure you have system admin access (add if not exists)
INSERT INTO user_roles (
  user_id,
  practice_id,
  role,
  meeting_notes_access,
  gp_scribe_access,
  complaints_manager_access,
  complaints_admin_access,
  replywell_access,
  ai_4_pm_access,
  assigned_by
) VALUES (
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  NULL,
  'system_admin',
  true,
  true,
  true,
  true,
  true,
  true,
  'e3aea82f-451b-40fb-8681-2b579a92dc3a'
)
ON CONFLICT (user_id, role, practice_id) DO UPDATE SET
  meeting_notes_access = EXCLUDED.meeting_notes_access,
  gp_scribe_access = EXCLUDED.gp_scribe_access,
  complaints_manager_access = EXCLUDED.complaints_manager_access,
  complaints_admin_access = EXCLUDED.complaints_admin_access,
  replywell_access = EXCLUDED.replywell_access,
  ai_4_pm_access = EXCLUDED.ai_4_pm_access;