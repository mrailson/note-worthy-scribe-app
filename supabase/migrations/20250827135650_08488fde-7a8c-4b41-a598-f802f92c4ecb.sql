-- Fix Lucy Hibberd's practice name and user role assignment

-- First, update the practice_name in her practice_details record
UPDATE practice_details 
SET practice_name = 'Bugbrooke Medical Practice'
WHERE user_id = '3eecbf7f-4956-4f29-94d6-21910819b0b5' 
AND id = 'ebe8a92d-031d-40c0-bd5e-73bc6399e9c8';

-- Second, update her user_roles to point to the correct practice_details ID
UPDATE user_roles 
SET practice_id = 'ebe8a92d-031d-40c0-bd5e-73bc6399e9c8'
WHERE user_id = '3eecbf7f-4956-4f29-94d6-21910819b0b5';