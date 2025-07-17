-- Create a function to make the first user a system admin (for initial setup)
-- You can run this manually for your user account

-- Example: To make a specific user system admin, replace 'your-email@example.com' with your actual email
-- INSERT INTO public.user_roles (user_id, role, assigned_by) 
-- SELECT p.user_id, 'system_admin', p.user_id
-- FROM public.profiles p 
-- WHERE p.email = 'your-email@example.com'
-- ON CONFLICT (user_id, role, practice_id) DO NOTHING;

-- Alternative: Make the first created user a system admin (uncomment if needed)
-- INSERT INTO public.user_roles (user_id, role, assigned_by)
-- SELECT p.user_id, 'system_admin', p.user_id
-- FROM public.profiles p
-- ORDER BY p.created_at ASC
-- LIMIT 1
-- ON CONFLICT (user_id, role, practice_id) DO NOTHING;