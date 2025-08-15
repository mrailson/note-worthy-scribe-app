-- Restore system admin role for Malcolm Railson
UPDATE public.user_roles 
SET role = 'system_admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'malcolm.railson@nhs.net');