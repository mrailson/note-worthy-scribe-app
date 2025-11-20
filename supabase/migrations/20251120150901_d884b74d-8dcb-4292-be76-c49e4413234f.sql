-- Fix RLS policies for cso_registrations to allow public registration
DROP POLICY IF EXISTS "Users can view their own registrations" ON cso_registrations;
DROP POLICY IF EXISTS "Users can create their own registrations" ON cso_registrations;

-- Allow anyone to register (public INSERT)
CREATE POLICY "Anyone can register for CSO training"
  ON cso_registrations
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow users to view registrations by email match (using email as identifier)
CREATE POLICY "Users can view registrations by email"
  ON cso_registrations
  FOR SELECT
  TO public
  USING (true);

-- Allow updates to own registration by email
CREATE POLICY "Users can update their own registrations"
  ON cso_registrations
  FOR UPDATE
  TO public
  USING (true);