-- Update module access for eGPlearning@gmail.com
-- Enable meeting_notes_access and AI4GP access

-- Update user_roles table for meeting notes access
UPDATE user_roles 
SET meeting_notes_access = true
WHERE user_id = '1876c974-6ea7-4491-a16c-f3e99f5e3ff4';

-- Update profiles table for AI4GP access
UPDATE profiles 
SET ai4gp_access = true
WHERE user_id = '1876c974-6ea7-4491-a16c-f3e99f5e3ff4';

-- Verify the updates
SELECT 
  p.email,
  p.full_name,
  ur.meeting_notes_access,
  p.ai4gp_access
FROM profiles p
JOIN user_roles ur ON p.user_id = ur.user_id
WHERE p.user_id = '1876c974-6ea7-4491-a16c-f3e99f5e3ff4';