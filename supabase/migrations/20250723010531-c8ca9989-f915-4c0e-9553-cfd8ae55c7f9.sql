-- Assign user malcolm.railson@nhs.net to Saxon Spires Practice
-- Update existing system_admin role to include practice assignment

UPDATE public.user_roles 
SET 
    practice_id = '97303cd8-9e9c-4422-b50f-cbe160e71d62',
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
        'practice_name', 'Saxon Spires Practice',
        'practice_id', '97303cd8-9e9c-4422-b50f-cbe160e71d62',
        'role', 'practice_manager',
        'assigned_by', 'system'
    )
);