-- Drop all existing policies on CSO tables
DROP POLICY IF EXISTS "Users can view their own registrations" ON cso_registrations;
DROP POLICY IF EXISTS "Users can create their own registrations" ON cso_registrations;
DROP POLICY IF EXISTS "Anyone can register for CSO training" ON cso_registrations;
DROP POLICY IF EXISTS "Users can view registrations by email" ON cso_registrations;
DROP POLICY IF EXISTS "Users can update their own registrations" ON cso_registrations;

-- Create simple public access policies for cso_registrations
CREATE POLICY "Public can insert registrations"
  ON cso_registrations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can view registrations"
  ON cso_registrations
  FOR SELECT
  USING (true);

CREATE POLICY "Public can update registrations"
  ON cso_registrations
  FOR UPDATE
  USING (true);

-- Ensure similar access for cso_assessments
DROP POLICY IF EXISTS "Users can insert their own assessments" ON cso_assessments;
DROP POLICY IF EXISTS "Users can view their own assessments" ON cso_assessments;

CREATE POLICY "Public can insert assessments"
  ON cso_assessments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can view assessments"
  ON cso_assessments
  FOR SELECT
  USING (true);

-- Ensure access for cso_training_progress
DROP POLICY IF EXISTS "Users can insert their own progress" ON cso_training_progress;
DROP POLICY IF EXISTS "Users can view their own progress" ON cso_training_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON cso_training_progress;

CREATE POLICY "Public can manage training progress"
  ON cso_training_progress
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Ensure access for cso_certificates
DROP POLICY IF EXISTS "Users can view their own certificates" ON cso_certificates;

CREATE POLICY "Public can view certificates"
  ON cso_certificates
  FOR SELECT
  USING (true);

CREATE POLICY "Public can insert certificates"
  ON cso_certificates
  FOR INSERT
  WITH CHECK (true);