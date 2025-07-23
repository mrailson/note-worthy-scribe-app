-- Assign user malcolm.railson@nhs.net to The Saxon Spires Practice
-- Update existing system_admin role to include practice assignment

UPDATE public.user_roles 
SET 
    practice_id = '4938b855-b13f-4f70-abc5-1f3c1db5f449', -- The Saxon Spires Practice from gp_practices table
    role = 'practice_manager'::app_role,
    gp_scribe_access = true,
    meeting_notes_access = true,
    replywell_access = true,
    complaints_manager_access = true,
    assigned_at = now()
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a'
AND role = 'system_admin'::app_role;

-- Log the assignment action
SELECT public.log_system_activity(
    'user_roles', 
    'USER_PRACTICE_ASSIGNMENT', 
    'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid,
    NULL,
    jsonb_build_object(
        'user_email', 'malcolm.railson@nhs.net',
        'practice_name', 'The Saxon Spires Practice',
        'practice_id', '4938b855-b13f-4f70-abc5-1f3c1db5f449',
        'role', 'practice_manager',
        'assigned_by', 'system'
    )
);