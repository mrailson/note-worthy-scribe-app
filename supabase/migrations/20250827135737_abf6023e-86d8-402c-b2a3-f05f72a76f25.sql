-- Fix Lucy Hibberd's empty practice name in practice_details
UPDATE practice_details 
SET practice_name = 'Bugbrooke Medical Practice'
WHERE user_id = '3eecbf7f-4956-4f29-94d6-21910819b0b5' 
AND id = 'ebe8a92d-031d-40c0-bd5e-73bc6399e9c8'
AND practice_name IS NULL;