-- Create demo staff and practice data for Enhanced Access
DO $$
DECLARE
    demo_user_id UUID := 'e3aea82f-451b-40fb-8681-2b579a92dc3a';
    practice_id_var UUID;
    existing_practice_count INTEGER;
BEGIN
    -- Create/update profile for this user
    INSERT INTO public.profiles (user_id, full_name, email, ai4gp_access)
    VALUES (demo_user_id, 'Demo Practice Manager', 'malcolm.railson@nhs.net', true)
    ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        ai4gp_access = EXCLUDED.ai4gp_access;
    
    -- Check if practice already exists for this user
    SELECT COUNT(*) INTO existing_practice_count FROM public.practice_details WHERE user_id = demo_user_id;
    
    -- Create a practice for this user if one doesn't exist
    IF existing_practice_count = 0 THEN
        INSERT INTO public.practice_details (user_id, practice_name, address, phone, email, pcn_code)
        VALUES (
            demo_user_id,
            'Enhanced Access Demo Practice',
            '123 Healthcare Street, Medical District',
            '01234 567890',
            'demo@practice.nhs.uk',
            'PCN001'
        );
    END IF;
    
    -- Get the practice ID
    SELECT id INTO practice_id_var FROM public.practice_details WHERE user_id = demo_user_id LIMIT 1;
    
    -- Assign practice manager role
    INSERT INTO public.user_roles (user_id, role, practice_id, assigned_by, assigned_at)
    VALUES (demo_user_id, 'practice_manager', practice_id_var, demo_user_id, now())
    ON CONFLICT (user_id, role, practice_id) DO NOTHING;
    
    -- Also give system admin access for enhanced permissions
    INSERT INTO public.user_roles (user_id, role, assigned_by, assigned_at)
    SELECT demo_user_id, 'system_admin', demo_user_id, now()
    WHERE NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = demo_user_id AND role = 'system_admin'
    );
    
    -- Create some sample staff members for the Enhanced Access demo
    INSERT INTO public.staff_members (name, email, role, hourly_rate, is_active) VALUES
    ('Dr. Sarah Johnson', 'sarah.johnson@practice.nhs.uk', 'gp', 85.00, true),
    ('Dr. Michael Brown', 'michael.brown@practice.nhs.uk', 'gp', 80.00, true),
    ('Jane Smith', 'jane.smith@practice.nhs.uk', 'phlebotomist', 25.00, true),
    ('Mark Wilson', 'mark.wilson@practice.nhs.uk', 'nurse', 35.00, true),
    ('Lisa Davis', 'lisa.davis@practice.nhs.uk', 'hca', 22.00, true)
    ON CONFLICT (email) DO NOTHING;
    
    -- Create some sample shift templates
    INSERT INTO public.shift_templates (name, day_of_week, start_time, end_time, required_role, location, is_active) VALUES
    ('Monday Morning GP', 1, '08:00:00', '12:00:00', 'gp', 'kings_heath', true),
    ('Monday Afternoon Phlebotomy', 1, '13:00:00', '17:00:00', 'phlebotomist', 'kings_heath', true),
    ('Tuesday Morning GP', 2, '08:00:00', '12:00:00', 'gp', 'various_practices', true),
    ('Tuesday Afternoon Nurse', 2, '13:00:00', '17:00:00', 'nurse', 'kings_heath', true),
    ('Wednesday Morning GP', 3, '08:00:00', '12:00:00', 'gp', 'remote', true),
    ('Wednesday Afternoon HCA', 3, '13:00:00', '17:00:00', 'hca', 'kings_heath', true),
    ('Thursday Morning GP', 4, '08:00:00', '12:00:00', 'gp', 'kings_heath', true),
    ('Friday Morning GP', 5, '08:00:00', '12:00:00', 'gp', 'various_practices', true),
    ('Friday Afternoon Phlebotomy', 5, '13:00:00', '17:00:00', 'phlebotomist', 'kings_heath', true),
    ('Saturday Extended Hours', 6, '08:00:00', '18:00:00', 'gp', 'kings_heath', true)
    ON CONFLICT (name, day_of_week) DO NOTHING;
    
    RAISE NOTICE 'Demo practice manager account and staff data created successfully';
END $$;