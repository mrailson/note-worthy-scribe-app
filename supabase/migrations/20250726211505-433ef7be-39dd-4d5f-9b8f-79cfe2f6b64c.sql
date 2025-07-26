-- First, let's create the Oak Lane practice
INSERT INTO practice_details (
  id,
  user_id,
  practice_name,
  created_at,
  updated_at,
  is_default,
  use_for_all_meetings
) VALUES (
  gen_random_uuid(),
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'Oak Lane Medical Practice',
  now(),
  now(),
  true,
  true
);

-- Clean up duplicate/invalid role assignments
DELETE FROM user_roles 
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' 
AND practice_id = 'c800c954-3928-4a37-a5c4-c4ff3e680333';

-- Get the new Oak Lane practice ID and assign the user as practice manager
WITH new_practice AS (
  SELECT id FROM practice_details 
  WHERE practice_name = 'Oak Lane Medical Practice' 
  AND user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a'
)
INSERT INTO user_roles (user_id, practice_id, role, assigned_by, assigned_at)
SELECT 
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  new_practice.id,
  'practice_manager'::app_role,
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  now()
FROM new_practice;

-- Remove the old Saxon Spires practice details if it exists
DELETE FROM practice_details 
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' 
AND practice_name = 'The Saxon Spires Practice';