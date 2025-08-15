-- Update the profile to grant AI4GP access
UPDATE profiles 
SET ai4gp_access = true 
WHERE email = 'matthew.hutton3@nhs.net';

-- Also update the user_roles table to ensure consistency
UPDATE user_roles 
SET ai_4_pm_access = true 
WHERE user_id = (SELECT user_id FROM profiles WHERE email = 'matthew.hutton3@nhs.net');