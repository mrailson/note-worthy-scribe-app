-- Create Oak Lane Medical Practice
INSERT INTO gp_practices (
  name,
  practice_code,
  ics_code,
  ics_name,
  organisation_type
) VALUES (
  'Oak Lane Medical Practice',
  'K85999',
  'ICS001',
  'Test Integrated Care System',
  'GP Practice'
);

-- Get the practice ID and assign user as practice manager
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
) 
SELECT 
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  gp.id,
  'practice_manager',
  true,
  true,
  true,
  true,
  true,
  true,
  'e3aea82f-451b-40fb-8681-2b579a92dc3a'
FROM gp_practices gp 
WHERE gp.practice_code = 'K85999';