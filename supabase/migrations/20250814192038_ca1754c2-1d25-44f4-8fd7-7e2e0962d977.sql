-- Add AI4GP access control to profiles table
ALTER TABLE public.profiles 
ADD COLUMN ai4gp_access BOOLEAN DEFAULT false;