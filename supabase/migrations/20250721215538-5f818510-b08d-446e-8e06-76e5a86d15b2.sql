-- Ensure malcolm.railson@nhs.net is a system admin with full access
-- This will work even if the user already has the role (ON CONFLICT handling)

INSERT INTO public.user_roles (user_id, role, assigned_by) 
SELECT p.user_id, 'system_admin'::app_role, p.user_id
FROM public.profiles p 
WHERE p.email = 'malcolm.railson@nhs.net'
ON CONFLICT (user_id, role, practice_id) DO NOTHING;

-- Verify the role was assigned
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.profiles p ON ur.user_id = p.user_id
        WHERE p.email = 'malcolm.railson@nhs.net' 
        AND ur.role = 'system_admin'
    ) THEN
        RAISE EXCEPTION 'Failed to assign system_admin role to malcolm.railson@nhs.net';
    ELSE
        RAISE NOTICE 'Successfully confirmed system_admin role for malcolm.railson@nhs.net';
    END IF;
END $$;