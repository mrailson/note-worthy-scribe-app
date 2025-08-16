-- Add GP Scribe module access for the current user
INSERT INTO user_modules (user_id, module, enabled, granted_at)
VALUES 
  ('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'gp_scribe', true, now())
ON CONFLICT (user_id, module) 
DO UPDATE SET 
  enabled = true,
  updated_at = now();