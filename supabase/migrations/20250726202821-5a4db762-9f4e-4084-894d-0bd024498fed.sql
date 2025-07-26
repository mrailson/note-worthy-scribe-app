-- Now update the user roles to grant system admin access and enable AI 4 PM
UPDATE user_roles 
SET 
  role = 'system_admin',
  ai_4_pm_access = true,
  complaints_admin_access = true
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';