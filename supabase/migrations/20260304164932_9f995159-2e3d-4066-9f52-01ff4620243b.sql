-- Fix the actual existing policies (they have slightly different names)
DROP POLICY IF EXISTS "Users can create their own practice details" ON practice_details;
DROP POLICY IF EXISTS "Users can delete their own practice details" ON practice_details;

-- Recreate with TO authenticated
CREATE POLICY "Users can create their own practice details" ON practice_details
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own practice details" ON practice_details
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_system_admin());