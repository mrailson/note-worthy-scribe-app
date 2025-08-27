-- Create user account directly in Supabase
-- First, let's check if pgcrypto extension is available for password hashing
-- This approach creates the user with the proper structure

DO $$
DECLARE
    new_user_id uuid := gen_random_uuid();
    practice_id uuid := 'c800c954-3928-4a37-a5c4-c4ff3e680333'; -- Oak Lane Medical Practice
BEGIN
    -- Insert into auth.users (this might work since we're doing it via migration)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        new_user_id,
        'authenticated',
        'authenticated',
        'egplearning@gmail.com',
        '$2a$10$' || encode(digest('SurgeryConnect1', 'sha256'), 'hex'), -- Simple hash approach
        now(),
        null,
        null,
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now(),
        '',
        '',
        '',
        ''
    ) ON CONFLICT (email) DO UPDATE SET
        email = EXCLUDED.email;

    -- Create profile entry
    INSERT INTO public.profiles (
        id,
        user_id,
        email,
        full_name,
        ai4gp_access,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        new_user_id,
        'egplearning@gmail.com',
        'EGP Learning User',
        true,
        now(),
        now()
    ) ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    -- Assign system admin role
    INSERT INTO public.user_roles (
        user_id,
        role,
        practice_id,
        assigned_by,
        assigned_at,
        meeting_notes_access,
        gp_scribe_access,
        complaints_manager_access,
        complaints_admin_access,
        replywell_access,
        enhanced_access,
        cqc_compliance_access,
        shared_drive_access,
        mic_test_service_access,
        api_testing_service_access,
        practice_role
    ) VALUES (
        new_user_id,
        'system_admin'::app_role,
        practice_id,
        new_user_id, -- Self-assigned
        now(),
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        'practice_manager'::practice_role
    ) ON CONFLICT (user_id, role, practice_id) DO NOTHING;

END $$;