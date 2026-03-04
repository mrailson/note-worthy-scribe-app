-- Fix RLS policies on practice_details: change INSERT and DELETE from TO public to TO authenticated

-- Drop existing INSERT and DELETE policies
DROP POLICY IF EXISTS "Users can create own practice details" ON practice_details;
DROP POLICY IF EXISTS "Users can delete own practice details" ON practice_details;
DROP POLICY IF EXISTS "Enable insert for users" ON practice_details;
DROP POLICY IF EXISTS "Enable delete for users" ON practice_details;

-- Recreate with TO authenticated
CREATE POLICY "Users can create own practice details" ON practice_details
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own practice details" ON practice_details
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_system_admin());