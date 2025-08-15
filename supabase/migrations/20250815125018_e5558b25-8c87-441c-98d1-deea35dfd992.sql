-- Fix the user role to system_admin
UPDATE public.user_roles 
SET role = 'system_admin'
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';