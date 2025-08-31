-- Fix the stuck meeting by updating its status to completed
-- This will trigger the automation for the test meeting
UPDATE meetings 
SET status = 'completed' 
WHERE status = 'recording' 
AND user_id IN (SELECT id FROM auth.users LIMIT 1);