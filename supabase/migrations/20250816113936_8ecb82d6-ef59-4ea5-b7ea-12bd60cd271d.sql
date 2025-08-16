-- Create demo staff and practice data for Enhanced Access (simplified)
-- Create/update profile for the user
INSERT INTO public.profiles (user_id, full_name, email, ai4gp_access)
VALUES ('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Demo Practice Manager', 'malcolm.railson@nhs.net', true)
ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    ai4gp_access = EXCLUDED.ai4gp_access;

-- Create a practice for this user if one doesn't exist
INSERT INTO public.practice_details (user_id, practice_name, address, phone, email, pcn_code)
SELECT 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Enhanced Access Demo Practice', '123 Healthcare Street, Medical District', '01234 567890', 'demo@practice.nhs.uk', 'PCN001'
WHERE NOT EXISTS (
    SELECT 1 FROM public.practice_details WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a'
);

-- Get the practice ID and assign roles
DO $$
DECLARE
    demo_user_id UUID := 'e3aea82f-451b-40fb-8681-2b579a92dc3a';
    practice_id_var UUID;
BEGIN
    SELECT id INTO practice_id_var FROM public.practice_details WHERE user_id = demo_user_id LIMIT 1;
    
    -- Assign practice manager role
    INSERT INTO public.user_roles (user_id, role, practice_id, assigned_by, assigned_at)
    VALUES (demo_user_id, 'practice_manager', practice_id_var, demo_user_id, now())
    ON CONFLICT (user_id, role, practice_id) DO NOTHING;
    
    -- Give system admin access for enhanced permissions
    INSERT INTO public.user_roles (user_id, role, assigned_by, assigned_at)
    SELECT demo_user_id, 'system_admin', demo_user_id, now()
    WHERE NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = demo_user_id AND role = 'system_admin'
    );
END $$;