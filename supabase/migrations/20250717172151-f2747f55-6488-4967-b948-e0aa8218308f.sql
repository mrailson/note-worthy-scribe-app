-- Fix RLS policy recursion for user_roles table
-- Drop existing conflicting policies
DROP POLICY IF EXISTS "System admins can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Practice managers can view practice roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Create non-recursive policies for user_roles
CREATE POLICY "System admins can view all user roles" 
ON user_roles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur2 
    WHERE ur2.user_id = auth.uid() 
    AND ur2.role = 'system_admin'
  )
);

CREATE POLICY "Users can view their own roles" 
ON user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Practice managers can view practice roles" 
ON user_roles 
FOR SELECT 
USING (
  practice_id IN (
    SELECT ur3.practice_id 
    FROM user_roles ur3 
    WHERE ur3.user_id = auth.uid() 
    AND ur3.role = 'practice_manager'
    AND ur3.practice_id IS NOT NULL
  )
);