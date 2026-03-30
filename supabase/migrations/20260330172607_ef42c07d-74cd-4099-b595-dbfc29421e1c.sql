DELETE FROM user_generated_images 
WHERE created_at < NOW() - INTERVAL '7 days' 
AND user_id IN (
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  '3eecbf7f-4956-4f29-94d6-21910819b0b5',
  'fcfad128-2a65-4fd0-8b15-5d990262172f'
);