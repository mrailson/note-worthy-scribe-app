-- Add new columns for local policy guidance settings to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS show_ai_service boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS northamptonshire_icb_active boolean DEFAULT false;