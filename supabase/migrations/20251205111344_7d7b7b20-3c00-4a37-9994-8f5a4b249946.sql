-- Add lg_capture_access column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS lg_capture_access boolean DEFAULT false;