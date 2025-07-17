-- Delete duplicate meetings keeping only the first one of each duplicate set
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY title, start_time, meeting_type ORDER BY created_at) as row_num
  FROM meetings
  WHERE title = 'General Meeting' 
    AND start_time = '2025-07-17 15:22:03.071+00'
    AND meeting_type = 'consultation'
)
DELETE FROM meetings 
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);