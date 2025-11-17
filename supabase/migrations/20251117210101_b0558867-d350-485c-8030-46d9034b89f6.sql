-- ============================================================================
-- REMOVE OLD PUBLIC POLICIES - Critical Security Fix
-- ============================================================================
-- The previous migration created new policies but old public ones remain
-- This migration removes ALL permissive public policies
-- ============================================================================

-- ============================================================================
-- Fix fridge_temperature_readings - Remove ALL public access policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow all temperature recordings" ON fridge_temperature_readings;
DROP POLICY IF EXISTS "Allow deleting temperature readings" ON fridge_temperature_readings;
DROP POLICY IF EXISTS "Allow updating temperature readings" ON fridge_temperature_readings;
DROP POLICY IF EXISTS "Allow viewing temperature readings" ON fridge_temperature_readings;
DROP POLICY IF EXISTS "Enable read access for all users" ON fridge_temperature_readings;
DROP POLICY IF EXISTS "Public can view temperature readings" ON fridge_temperature_readings;
DROP POLICY IF EXISTS "Practice users can view their practice fridge readings" ON fridge_temperature_readings;

-- Verify only secure policies remain (these should already exist from previous migration)
-- If they don't exist, create them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'fridge_temperature_readings' 
    AND policyname = 'Practice staff can view their fridge readings'
  ) THEN
    CREATE POLICY "Practice staff can view their fridge readings"
    ON fridge_temperature_readings FOR SELECT
    USING (
      fridge_id IN (
        SELECT f.id FROM practice_fridges f
        WHERE f.practice_id = ANY(get_user_practice_ids(auth.uid()))
      )
    );
  END IF;
END $$;

-- ============================================================================
-- Fix practice_fridges - Remove ALL public access policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow all fridge operations" ON practice_fridges;
DROP POLICY IF EXISTS "Anyone can view fridges" ON practice_fridges;
DROP POLICY IF EXISTS "Enable read access for all users" ON practice_fridges;
DROP POLICY IF EXISTS "Public can view fridge details for QR scanning" ON practice_fridges;
DROP POLICY IF EXISTS "Users can view fridges for their practices" ON practice_fridges;
DROP POLICY IF EXISTS "Allow viewing all fridges" ON practice_fridges;

-- ============================================================================
-- Fix practice_manager_feedback - Remove ALL public access policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow all feedback viewing" ON practice_manager_feedback;
DROP POLICY IF EXISTS "Anyone can view feedback" ON practice_manager_feedback;
DROP POLICY IF EXISTS "Enable read access for all users" ON practice_manager_feedback;
DROP POLICY IF EXISTS "Public can view anonymized feedback results" ON practice_manager_feedback;
DROP POLICY IF EXISTS "Allow viewing feedback" ON practice_manager_feedback;

-- ============================================================================
-- Verification: Check remaining policies
-- ============================================================================
-- Run this manually to verify only secure policies remain:
-- SELECT tablename, policyname, cmd, qual::text 
-- FROM pg_policies 
-- WHERE tablename IN ('fridge_temperature_readings', 'practice_fridges', 'practice_manager_feedback')
-- ORDER BY tablename, policyname;

-- Expected result:
-- - NO policies with qual = 'true' (unrestricted access)
-- - ALL policies should check auth.uid() or get_user_practice_ids()
-- - practice_fridges should have 2 policies (view, manage)
-- - fridge_temperature_readings should have 3 policies (view, insert, update)
-- - practice_manager_feedback should have 2 policies (admin view, manager view)