-- Grant Survey Manager module access for Dr Kant
UPDATE public.user_roles
SET survey_manager_access = true
WHERE user_id = 'f03e3f37-4e17-441e-b074-933af6a0dc37';