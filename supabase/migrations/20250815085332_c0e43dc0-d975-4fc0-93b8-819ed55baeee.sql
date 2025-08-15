-- Remove AI 4 PM access while keeping AI4GP access
UPDATE user_roles 
SET ai_4_pm_access = false 
WHERE user_id = (SELECT user_id FROM profiles WHERE email = 'matthew.hutton3@nhs.net');