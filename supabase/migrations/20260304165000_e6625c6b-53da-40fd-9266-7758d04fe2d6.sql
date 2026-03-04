-- Clean up Nicola Draper's duplicate practice_details records
-- Keep dd2c6a96 (most recent with valid data), delete the other two

DELETE FROM practice_details WHERE id IN ('f9e8fffe-0000-0000-0000-000000000000', '54b8a23a-0000-0000-0000-000000000000')
AND user_id = '8637a642-97d1-4a5a-ba0f-6ea503a4ae3c';

-- Set is_default = true on the remaining record
UPDATE practice_details SET is_default = true 
WHERE user_id = '8637a642-97d1-4a5a-ba0f-6ea503a4ae3c';