-- Add shared drive visibility setting to profiles table
ALTER TABLE public.profiles 
ADD COLUMN shared_drive_visible BOOLEAN NOT NULL DEFAULT true;