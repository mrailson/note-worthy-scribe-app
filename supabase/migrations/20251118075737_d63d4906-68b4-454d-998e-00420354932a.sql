-- =====================================================
-- CRITICAL SECURITY FIX: Lock Down Public Data Access
-- =====================================================
-- This migration addresses 3 CRITICAL security vulnerabilities:
-- 1. PUBLIC_TEMPERATURE_DATA (fridge_temperature_readings)
-- 2. PUBLIC_PRACTICE_DATA (practice_fridges)
-- 3. PUBLIC_FEEDBACK_DATA (practice_manager_feedback)

-- =====================================================
-- STEP 1: Fix fridge_temperature_readings
-- =====================================================
-- Remove the overly permissive policy that allows any INSERT
DROP POLICY IF EXISTS "Unified temperature recording policy" ON public.fridge_temperature_readings;

-- Verify RLS is enabled
ALTER TABLE public.fridge_temperature_readings ENABLE ROW LEVEL SECURITY;

-- The existing practice-scoped policies are already correct:
-- ✓ "Practice staff can view their fridge readings" (SELECT)
-- ✓ "Practice staff can insert readings for their fridges" (INSERT)
-- ✓ "System can update temperature readings" (UPDATE)

-- =====================================================
-- STEP 2: Fix practice_fridges
-- =====================================================
-- Drop ALL existing overlapping policies to start fresh
DROP POLICY IF EXISTS "Practice managers can manage fridges" ON public.practice_fridges;
DROP POLICY IF EXISTS "Practice managers can manage their practice fridges" ON public.practice_fridges;
DROP POLICY IF EXISTS "Practice staff can view their fridges" ON public.practice_fridges;
DROP POLICY IF EXISTS "Practice users can view their practice fridges" ON public.practice_fridges;
DROP POLICY IF EXISTS "Users can view fridges in their practice" ON public.practice_fridges;

-- Verify RLS is enabled
ALTER TABLE public.practice_fridges ENABLE ROW LEVEL SECURITY;

-- Create consolidated policies with consistent logic
CREATE POLICY "practice_fridges_select_policy" ON public.practice_fridges
  FOR SELECT
  TO authenticated
  USING (practice_id = ANY(get_user_practice_ids(auth.uid())));

CREATE POLICY "practice_fridges_insert_policy" ON public.practice_fridges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    practice_id = ANY(get_user_practice_ids(auth.uid()))
    AND (has_role(auth.uid(), 'practice_manager'::app_role) OR is_system_admin(auth.uid()))
  );

CREATE POLICY "practice_fridges_update_policy" ON public.practice_fridges
  FOR UPDATE
  TO authenticated
  USING (practice_id = ANY(get_user_practice_ids(auth.uid())))
  WITH CHECK (
    practice_id = ANY(get_user_practice_ids(auth.uid()))
    AND (has_role(auth.uid(), 'practice_manager'::app_role) OR is_system_admin(auth.uid()))
  );

CREATE POLICY "practice_fridges_delete_policy" ON public.practice_fridges
  FOR DELETE
  TO authenticated
  USING (
    practice_id = ANY(get_user_practice_ids(auth.uid()))
    AND (has_role(auth.uid(), 'practice_manager'::app_role) OR is_system_admin(auth.uid()))
  );

-- =====================================================
-- STEP 3: Fix practice_manager_feedback
-- =====================================================
-- Drop overly permissive SELECT policies
DROP POLICY IF EXISTS "Practice managers can view their practice feedback" ON public.practice_manager_feedback;
DROP POLICY IF EXISTS "System admins can view all feedback" ON public.practice_manager_feedback;

-- Verify RLS is enabled
ALTER TABLE public.practice_manager_feedback ENABLE ROW LEVEL SECURITY;

-- Keep the anonymous INSERT policy (intentional for feedback form)
-- This already exists: "Anyone can submit feedback"

-- Recreate SELECT with proper role restrictions (managers only see their practice)
CREATE POLICY "feedback_select_managers" ON public.practice_manager_feedback
  FOR SELECT
  TO authenticated
  USING (
    practice_id = ANY(get_user_practice_ids(auth.uid()))
    AND has_role(auth.uid(), 'practice_manager'::app_role)
  );

-- System admins can view all feedback
CREATE POLICY "feedback_select_admins" ON public.practice_manager_feedback
  FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

-- Keep existing admin UPDATE/DELETE policies (already correct)
-- ✓ "System admins can update feedback" (UPDATE)
-- ✓ "System admins can delete feedback" (DELETE)

-- =====================================================
-- STEP 4: Ensure Public Views Remain Functional
-- =====================================================
-- Grant SELECT on public_fridge_qr_view for QR code scanning
GRANT SELECT ON public.public_fridge_qr_view TO anon;
GRANT SELECT ON public.public_fridge_qr_view TO authenticated;

-- The public_practice_feedback view uses the aggregated data
-- Anonymous INSERT is handled via the base table policy "Anyone can submit feedback"

-- =====================================================
-- VERIFICATION COMMENTS
-- =====================================================
-- Security Model Summary:
-- 
-- fridge_temperature_readings:
--   ✓ No public access to base table
--   ✓ Authenticated practice staff can read/write their own data
--   ✓ Public view (public_fridge_qr_view) provides QR codes only
--
-- practice_fridges:
--   ✓ No public access
--   ✓ Authenticated practice staff can view their fridges
--   ✓ Only managers/admins can modify
--   ✓ Public view provides practice info for QR scanning
--
-- practice_manager_feedback:
--   ✓ Anonymous users can INSERT feedback (intentional)
--   ✓ Only authenticated managers/admins can SELECT feedback
--   ✓ Practice isolation maintained (managers see only their practice)
--   ✓ Public view shows aggregated statistics only