-- Mark j.railson@nhs.net as email confirmed
UPDATE auth.users 
SET 
  email_confirmed_at = now(),
  updated_at = now()
WHERE email = 'j.railson@nhs.net'
  AND email_confirmed_at IS NULL;