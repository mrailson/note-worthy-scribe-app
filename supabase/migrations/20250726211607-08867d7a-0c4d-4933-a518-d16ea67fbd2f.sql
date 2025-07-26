-- First, let's handle the gp_signature_settings references
UPDATE gp_signature_settings 
SET practice_id = 'c800c954-3928-4a37-a5c4-c4ff3e680333'
WHERE practice_id = 'd5b95714-892e-47af-a3c3-de6d4f3880c2'
AND user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';

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

-- Now safely remove the old Saxon Spires practice details
DELETE FROM practice_details 
WHERE id = 'd5b95714-892e-47af-a3c3-de6d4f3880c2'
AND user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';

-- Update user_roles to point to Oak Lane  
UPDATE user_roles 
SET practice_id = 'c800c954-3928-4a37-a5c4-c4ff3e680333'
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' 
AND role = 'practice_manager'::app_role;