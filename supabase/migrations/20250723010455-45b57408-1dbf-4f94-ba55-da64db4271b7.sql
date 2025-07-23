-- Assign user malcolm.railson@nhs.net to Saxon Spires Practice

DO $$
DECLARE
    target_user_id UUID;
    target_practice_id UUID;
BEGIN
    -- Find the user by email
    SELECT user_id INTO target_user_id
    FROM public.profiles
    WHERE email = 'malcolm.railson@nhs.net';
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email malcolm.railson@nhs.net not found';
    END IF;
    
    -- Find the practice by name
    SELECT id INTO target_practice_id
    FROM public.practice_details
    WHERE practice_name = 'Saxon Spires Practice';
    
    IF target_practice_id IS NULL THEN
        RAISE EXCEPTION 'Practice with name Saxon Spires Practice not found';
    END IF;
    
    -- Check if user already has a role assignment for this practice
    IF EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = target_user_id 
        AND practice_id = target_practice_id
    ) THEN
        RAISE NOTICE 'User is already assigned to this practice';
    ELSE
        -- Assign user to practice with practice_manager role
        INSERT INTO public.user_roles (
            user_id,
            role,
            practice_id,
            assigned_by,
            gp_scribe_access,
            meeting_notes_access,
            replywell_access,
            complaints_manager_access
        ) VALUES (
            target_user_id,
            'practice_manager'::app_role,
            target_practice_id,
            target_user_id, -- Self-assigned for initial setup
            true, -- GP Scribe access
            true, -- Meeting notes access
            true, -- ReplyWell access
            true  -- Complaints manager access
        );
        
        RAISE NOTICE 'Successfully assigned user malcolm.railson@nhs.net to Saxon Spires Practice as practice manager';
    END IF;
END $$;