-- Add api_testing_service_access column to user_roles table
ALTER TABLE public.user_roles ADD COLUMN api_testing_service_access boolean DEFAULT false;