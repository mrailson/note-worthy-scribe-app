-- Update Lucy's practice name directly (without the NULL condition)
UPDATE practice_details 
SET practice_name = 'Bugbrooke Medical Practice'
WHERE user_id = '3eecbf7f-4956-4f29-94d6-21910819b0b5';

-- Also verify the update worked
SELECT id, user_id, practice_name, address 
FROM practice_details 
WHERE user_id = '3eecbf7f-4956-4f29-94d6-21910819b0b5';