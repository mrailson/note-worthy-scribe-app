-- Mark all existing test users as email confirmed
UPDATE auth.users 
SET 
  email_confirmed_at = now(),
  updated_at = now()
WHERE email_confirmed_at IS NULL
  AND (
    email LIKE '%@nhs.net' OR 
    email LIKE '%@nhs.uk' OR 
    email LIKE '%@nhft.nhs.uk'
  );

-- Also ensure their profiles exist and are properly linked
UPDATE public.profiles 
SET 
  full_name = COALESCE(full_name, split_part(email, '@', 1)),
  updated_at = now()
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email LIKE '%@nhs.net' OR email LIKE '%@nhs.uk' OR email LIKE '%@nhft.nhs.uk'
);