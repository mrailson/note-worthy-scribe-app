-- Check the current structure of user_roles table and add system_admin role
-- First, let's see what constraints exist
SELECT 
    constraint_name, 
    constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'user_roles' AND table_schema = 'public';

-- Add the system_admin role directly without conflict resolution since we know it doesn't exist
INSERT INTO public.user_roles (user_id, role, assigned_by, assigned_at)
VALUES ('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'system_admin', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', now());