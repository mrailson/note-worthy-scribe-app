-- Add ai4gp_disclaimer_collapsed column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN ai4gp_disclaimer_collapsed BOOLEAN DEFAULT false;