-- Add survey_manager_access column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS survey_manager_access boolean DEFAULT false;