-- Use the existing is_system_admin function to avoid recursion
-- Drop the problematic policies
DROP POLICY IF EXISTS "Allow system admin full access" ON user_roles;
DROP POLICY IF EXISTS "System admin insert" ON user_roles;
DROP POLICY IF EXISTS "System admin update" ON user_roles;
DROP POLICY IF EXISTS "System admin delete" ON user_roles;

-- Create policies using the existing is_system_admin function
CREATE POLICY "System admin select" 
ON user_roles 
FOR SELECT 
USING (is_system_admin());

CREATE POLICY "System admin insert" 
ON user_roles 
FOR INSERT 
WITH CHECK (is_system_admin());

CREATE POLICY "System admin update" 
ON user_roles 
FOR UPDATE 
USING (is_system_admin());

CREATE POLICY "System admin delete" 
ON user_roles 
FOR DELETE 
USING (is_system_admin());