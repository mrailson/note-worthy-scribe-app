-- Make malcolm.railson@nhs.net a system admin
INSERT INTO public.user_roles (user_id, role, assigned_by) 
SELECT p.user_id, 'system_admin', p.user_id
FROM public.profiles p 
WHERE p.email = 'malcolm.railson@nhs.net'
ON CONFLICT (user_id, role, practice_id) DO NOTHING;