-- Disable RLS temporarily and recreate with simpler approach
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "System admins have full access" ON user_roles;
DROP POLICY IF EXISTS "Practice managers can view their practice roles" ON user_roles;

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create the simplest possible policies that work
CREATE POLICY "Allow own role access" 
ON user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Allow system admin full access" 
ON user_roles 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    WHERE ur.role = 'system_admin' 
    AND ur.user_id = auth.uid()
  )
);

-- Allow system admins to insert/update/delete
CREATE POLICY "System admin insert" 
ON user_roles 
FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    WHERE ur.role = 'system_admin' 
    AND ur.user_id = auth.uid()
  )
);

CREATE POLICY "System admin update" 
ON user_roles 
FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    WHERE ur.role = 'system_admin' 
    AND ur.user_id = auth.uid()
  )
);

CREATE POLICY "System admin delete" 
ON user_roles 
FOR DELETE 
USING (
  auth.uid() IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    WHERE ur.role = 'system_admin' 
    AND ur.user_id = auth.uid()
  )
);