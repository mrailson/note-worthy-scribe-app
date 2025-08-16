-- Add GP Scribe module access for the current user
INSERT INTO user_modules (user_id, module, enabled, granted_at)
SELECT 
  auth.uid(),
  'gp_scribe',
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM user_modules 
  WHERE user_id = auth.uid() 
  AND module = 'gp_scribe'
);