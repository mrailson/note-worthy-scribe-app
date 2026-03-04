-- Delete the two older duplicate records for Nicola (keep dd2c6a96 which has the most recent valid data)
DELETE FROM practice_details 
WHERE id IN ('f9e8fffe-36e3-4966-bf02-fd2f20c311f5', '54b8a23a-ff11-406c-b55c-3c3498cee445')
AND user_id = '8637a642-97d1-4a5a-ba0f-6ea503a4ae3c';