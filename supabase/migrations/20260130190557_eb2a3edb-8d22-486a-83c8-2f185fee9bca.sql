-- Add policy_service to the service_type enum
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'policy_service';

-- Update Dr Kant's user_roles to enable survey_manager_access
UPDATE public.user_roles
SET survey_manager_access = true
WHERE user_id = 'f03e3f37-4e17-441e-b074-933af6a0dc37';