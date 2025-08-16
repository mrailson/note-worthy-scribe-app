-- Update user_roles to enable GP Scribe access
UPDATE user_roles 
SET gp_scribe_access = true,
    updated_at = now()
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';

-- If no user_roles record exists, create one
INSERT INTO user_roles (user_id, gp_scribe_access, created_at, updated_at)
SELECT 
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a'
);