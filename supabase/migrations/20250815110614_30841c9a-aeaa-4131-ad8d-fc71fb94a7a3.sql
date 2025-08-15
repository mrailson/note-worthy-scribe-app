-- Ensure the current user has system admin role
-- Check if the user exists and grant system admin access

-- First, ensure we have the enum value for system_admin
DO $$
BEGIN
    -- Create system_admin role if it doesn't exist in user_roles table
    INSERT INTO public.user_roles (user_id, role, assigned_by)
    SELECT 'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid, 'system_admin'::app_role, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid
    WHERE NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid 
        AND role = 'system_admin'::app_role
    );
END $$;