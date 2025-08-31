-- Fix the stuck test meeting by setting proper end_time and status
UPDATE meetings 
SET 
  status = 'completed',
  end_time = NOW(),
  duration_minutes = EXTRACT(EPOCH FROM (NOW() - start_time)) / 60
WHERE status = 'recording' 
  AND start_time IS NOT NULL;