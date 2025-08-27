-- Temporarily disable the NHS email constraint to allow Gmail address
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_nhs_email;

-- Create the user with Gmail address
INSERT INTO auth.users (
  id,
  email, 
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  'egplearning@gmail.com',
  crypt('SurgeryConnect1', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

-- Get the user ID for the newly created user
DO $$
DECLARE
  new_user_id uuid;
  practice_id uuid := 'c800c954-3928-4a37-a5c4-c4ff3e680333'; -- Oak Lane Medical Practice
BEGIN
  -- Get the user ID
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'egplearning@gmail.com';
  
  -- Create profile entry
  INSERT INTO public.profiles (
    id,
    user_id,
    email,
    full_name,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    'egplearning@gmail.com',
    'EGP Learning User',
    now(),
    now()
  ) ON CONFLICT (user_id) DO NOTHING;
  
  -- Assign practice manager role
  INSERT INTO public.user_roles (
    user_id,
    role,
    practice_id,
    assigned_by,
    assigned_at
  ) VALUES (
    new_user_id,
    'practice_manager',
    practice_id,
    new_user_id, -- Self-assigned for this special case
    now()
  ) ON CONFLICT (user_id, role, practice_id) DO NOTHING;
  
END $$;

-- Re-enable the NHS email constraint (but make it more flexible for special cases)
ALTER TABLE public.profiles ADD CONSTRAINT valid_nhs_email 
CHECK (
  email ILIKE '%@nhs.net' OR 
  email ILIKE '%@nhs.uk' OR 
  email = 'egplearning@gmail.com' -- Special exception for this user
);