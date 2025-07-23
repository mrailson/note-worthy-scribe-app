-- Make malcolm.railson@nhs.net a system admin with full access
-- Remove any existing practice-specific roles and assign system_admin role

DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Find the user by email
    SELECT user_id INTO target_user_id
    FROM public.profiles
    WHERE email = 'malcolm.railson@nhs.net';
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email malcolm.railson@nhs.net not found';
    END IF;
    
    -- Delete any existing roles for this user
    DELETE FROM public.user_roles 
    WHERE user_id = target_user_id;
    
    -- Insert system_admin role with full access
    INSERT INTO public.user_roles (
        user_id,
        role,
        practice_id,
        assigned_by,
        gp_scribe_access,
        meeting_notes_access,
        replywell_access,
        complaints_manager_access,
        complaints_admin_access
    ) VALUES (
        target_user_id,
        'system_admin'::app_role,
        NULL, -- System admins aren't tied to specific practices
        target_user_id,
        true, -- GP Scribe access
        true, -- Meeting notes access
        true, -- ReplyWell access
        true, -- Complaints manager access
        true  -- Complaints admin access
    );
    
    RAISE NOTICE 'Successfully assigned system_admin role to malcolm.railson@nhs.net with full access';
END $$;