-- Add translation_service_access column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN translation_service_access BOOLEAN DEFAULT false;