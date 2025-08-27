-- Fix RLS policy for practice_details to allow users assigned to a practice to access its details

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own practice details" ON practice_details;

-- Create a new policy that allows:
-- 1. Users to see practice details they created (user_id = auth.uid())
-- 2. Users to see practice details for practices they're assigned to via user_roles
CREATE POLICY "Users can view practice details they own or are assigned to" 
ON practice_details 
FOR SELECT 
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