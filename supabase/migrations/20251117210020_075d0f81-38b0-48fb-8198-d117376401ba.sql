-- ============================================================================
-- CRITICAL SECURITY FIX: Restrict Public Access to Sensitive NHS Data
-- ============================================================================
-- Addresses 3 CRITICAL vulnerabilities from Security Assessment Report
-- ============================================================================

-- ============================================================================
-- CRITICAL-01: Medical Facility Temperature Records Exposed
-- ============================================================================

ALTER TABLE fridge_temperature_readings ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Public can view temperature readings" ON fridge_temperature_readings';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can read temperature data" ON fridge_temperature_readings';
  EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON fridge_temperature_readings';
  EXECUTE 'DROP POLICY IF EXISTS "Practice staff can view their fridge readings" ON fridge_temperature_readings';
  EXECUTE 'DROP POLICY IF EXISTS "Practice staff can insert readings for their fridges" ON fridge_temperature_readings';
  EXECUTE 'DROP POLICY IF EXISTS "System can update temperature readings" ON fridge_temperature_readings';
EXCEPTION WHEN OTHERS THEN
  -- Policies may not exist, continue
  NULL;
END $$;

-- Create secure policies
CREATE POLICY "Practice staff can view their fridge readings"
ON fridge_temperature_readings FOR SELECT
USING (
  fridge_id IN (
    SELECT f.id FROM practice_fridges f
    WHERE f.practice_id = ANY(get_user_practice_ids(auth.uid()))
  )
);

CREATE POLICY "Practice staff can insert readings for their fridges"
ON fridge_temperature_readings FOR INSERT
WITH CHECK (
  fridge_id IN (
    SELECT f.id FROM practice_fridges f
    WHERE f.practice_id = ANY(get_user_practice_ids(auth.uid()))
  )
);

CREATE POLICY "System can update temperature readings"
ON fridge_temperature_readings FOR UPDATE
USING (
  fridge_id IN (
    SELECT f.id FROM practice_fridges f
    WHERE f.practice_id = ANY(get_user_practice_ids(auth.uid()))
  )
);

-- ============================================================================
-- CRITICAL-02: Medical Practice Locations Publicly Accessible  
-- ============================================================================

ALTER TABLE practice_fridges ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Public can view fridge details for QR scanning" ON practice_fridges';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can read fridge data" ON practice_fridges';
  EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON practice_fridges';
  EXECUTE 'DROP POLICY IF EXISTS "Practice staff can view their fridges" ON practice_fridges';
  EXECUTE 'DROP POLICY IF EXISTS "Practice managers can manage fridges" ON practice_fridges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view fridges for their practices" ON practice_fridges';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create secure policies
CREATE POLICY "Practice staff can view their fridges"
ON practice_fridges FOR SELECT
USING (
  practice_id = ANY(get_user_practice_ids(auth.uid()))
);

CREATE POLICY "Practice managers can manage fridges"
ON practice_fridges FOR ALL
USING (
  practice_id = ANY(get_user_practice_ids(auth.uid()))
  AND (
    has_role(auth.uid(), 'practice_manager'::app_role)
    OR has_role(auth.uid(), 'system_admin'::app_role)
  )
)
WITH CHECK (
  practice_id = ANY(get_user_practice_ids(auth.uid()))
  AND (
    has_role(auth.uid(), 'practice_manager'::app_role)
    OR has_role(auth.uid(), 'system_admin'::app_role)
  )
);

-- Anonymized view for QR scanning (NO exact locations)
DROP VIEW IF EXISTS public_fridge_qr_view;
CREATE VIEW public_fridge_qr_view AS
SELECT 
  id,
  qr_code_data,
  practice_id,
  'Medical Facility' as generic_location,
  is_active
FROM practice_fridges
WHERE is_active = true;

GRANT SELECT ON public_fridge_qr_view TO anon;
GRANT SELECT ON public_fridge_qr_view TO authenticated;

-- ============================================================================
-- CRITICAL-03: Practice Manager Feedback Including Emails Exposed
-- ============================================================================

ALTER TABLE practice_manager_feedback ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Public can view anonymized feedback results" ON practice_manager_feedback';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can read feedback" ON practice_manager_feedback';
  EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON practice_manager_feedback';
  EXECUTE 'DROP POLICY IF EXISTS "System admins can view all feedback" ON practice_manager_feedback';
  EXECUTE 'DROP POLICY IF EXISTS "Practice managers can view their practice feedback" ON practice_manager_feedback';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create secure policies
CREATE POLICY "System admins can view all feedback"
ON practice_manager_feedback FOR SELECT
USING (
  is_system_admin(auth.uid())
);

CREATE POLICY "Practice managers can view their practice feedback"
ON practice_manager_feedback FOR SELECT
USING (
  practice_id = ANY(get_user_practice_ids(auth.uid()))
  AND (
    has_role(auth.uid(), 'practice_manager'::app_role)
    OR has_role(auth.uid(), 'system_admin'::app_role)
  )
);

-- Anonymized public view (NO emails, NO names, NO IP addresses)
DROP VIEW IF EXISTS public_practice_feedback;
CREATE VIEW public_practice_feedback AS
SELECT 
  practice_name,
  DATE_TRUNC('month', created_at) as feedback_month,
  AVG(would_use_complaints_system) as avg_complaints_interest,
  AVG(complaints_system_usefulness) as avg_complaints_usefulness,
  AVG(would_use_meeting_manager) as avg_meeting_manager_interest,
  AVG(meeting_manager_usefulness) as avg_meeting_manager_usefulness,
  COUNT(*) as feedback_count
FROM practice_manager_feedback
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY practice_name, DATE_TRUNC('month', created_at);

GRANT SELECT ON public_practice_feedback TO anon;
GRANT SELECT ON public_practice_feedback TO authenticated;