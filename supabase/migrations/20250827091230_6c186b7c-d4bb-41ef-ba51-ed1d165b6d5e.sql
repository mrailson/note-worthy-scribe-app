-- Fix RLS policy for practice_details UPDATE to allow assigned users to modify signatures

-- Drop existing UPDATE policy if it exists
DROP POLICY IF EXISTS "Users can update their own practice details" ON practice_details;

-- Create new UPDATE policy that allows:
-- 1. Users who created the practice details (user_id = auth.uid())
-- 2. Users assigned to the practice via user_roles table
CREATE POLICY "Users can update practice details they own or are assigned to" 
ON practice_details 
FOR UPDATE 
USING (
  user_id = auth.uid() 
  OR 
  id IN (
    SELECT practice_id 
    FROM user_roles 
    WHERE user_id = auth.uid() 
    AND practice_id IS NOT NULL
  )
);