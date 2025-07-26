-- Temporarily disable the audit trigger
DROP TRIGGER IF EXISTS audit_role_changes_trigger ON user_roles;

-- Update existing user roles to grant system admin access and enable AI 4 PM
UPDATE user_roles 
SET 
  role = 'system_admin',
  ai_4_pm_access = true,
  complaints_admin_access = true
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' 
AND id = '881d0d12-9afc-48ed-95a9-1c624c259e7f';

-- Remove the duplicate role
DELETE FROM user_roles 
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a' 
AND id = 'e14c2ead-ad30-422e-b617-d49e7ee81952';

-- Re-enable the audit trigger
CREATE TRIGGER audit_role_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_role_changes();