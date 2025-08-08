-- Add shared_drive_access and mic_test_service modules to the app_module enum
ALTER TYPE app_module ADD VALUE 'shared_drive_access';
ALTER TYPE app_module ADD VALUE 'mic_test_service';

-- Add the new module columns to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN shared_drive_access boolean DEFAULT false,
ADD COLUMN mic_test_service_access boolean DEFAULT false;