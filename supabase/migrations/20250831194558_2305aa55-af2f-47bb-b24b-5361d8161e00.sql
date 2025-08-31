-- Fix the stuck meeting and create proper transcript
UPDATE meetings 
SET 
  status = 'completed',
  updated_at = now()
WHERE id = '77b6b634-4946-4d96-a403-7bf1b641cb89';