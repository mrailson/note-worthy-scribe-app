-- Remove the duplicate policies created by the first migration attempt
DROP POLICY IF EXISTS "Users can create own practice details" ON practice_details;
DROP POLICY IF EXISTS "Users can delete own practice details" ON practice_details;