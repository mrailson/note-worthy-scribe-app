-- Insert a test user profile for Practice Manager
-- Note: This creates the profile record, but the user still needs to sign up through the UI
-- for the auth.users record to be created

-- First, let's insert a test profile that will be linked when the user signs up
INSERT INTO public.profiles (
  user_id, 
  full_name, 
  email, 
  nhs_trust, 
  department, 
  role
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Sarah Johnson',
  'sarah.johnson@nhs.net',
  'Northamptonshire ICB',
  'Practice Management',
  'Practice Manager'
) ON CONFLICT (user_id) DO NOTHING;

-- Create a function to check if a test user should get special access
CREATE OR REPLACE FUNCTION public.is_test_user(email_address text)
RETURNS boolean AS $$
BEGIN
  RETURN email_address = 'sarah.johnson@nhs.net';
END;
$$ LANGUAGE plpgsql STABLE;