UPDATE meetings 
SET duration_minutes = ROUND(EXTRACT(EPOCH FROM (end_time::timestamp - start_time::timestamp)) / 60)
WHERE id = 'b340b42a-77e5-4b28-bd82-5c8dbb6c7d10' 
AND duration_minutes = 0