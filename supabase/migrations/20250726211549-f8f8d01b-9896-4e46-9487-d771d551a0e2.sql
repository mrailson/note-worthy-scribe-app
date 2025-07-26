-- Create practice_details entry for Oak Lane Medical Practice
INSERT INTO practice_details (
  id,
  user_id,
  practice_name,
  created_at,
  updated_at,
  is_default,
  use_for_all_meetings
) VALUES (
  'c800c954-3928-4a37-a5c4-c4ff3e680333', -- Use the same ID as in gp_practices
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  'Oak Lane Medical Practice',
  now(),
  now(),
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  practice_name = 'Oak Lane Medical Practice',
  updated_at = now();

-- Remove the old Saxon Spires practice details if it exists  
DELETE FROM practice_details 
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' 
AND practice_name = 'The Saxon Spires Practice';

-- Update existing user_roles to point to Oak Lane if there are any invalid ones
UPDATE user_roles 
SET practice_id = 'c800c954-3928-4a37-a5c4-c4ff3e680333'
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' 
AND role = 'practice_manager'::app_role;