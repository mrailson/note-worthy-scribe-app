-- Add specific overview for the July 23rd meeting if it exists
UPDATE public.meeting_overviews 
SET overview = 'Meeting discussed: pay rise discussions and performance review processes for team members'
WHERE meeting_id IN (
  SELECT m.id 
  FROM public.meetings m 
  WHERE DATE(m.start_time) = '2025-07-23' 
  AND EXTRACT(HOUR FROM m.start_time) = 13
  AND EXTRACT(MINUTE FROM m.start_time) = 5
  LIMIT 1
);