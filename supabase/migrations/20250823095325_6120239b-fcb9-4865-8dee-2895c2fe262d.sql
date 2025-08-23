-- Add disclaimer preference to user profiles
ALTER TABLE public.profiles 
ADD COLUMN show_ai4gp_disclaimer BOOLEAN DEFAULT true;

-- Update existing users to show disclaimer by default
UPDATE public.profiles 
SET show_ai4gp_disclaimer = true 
WHERE show_ai4gp_disclaimer IS NULL;