-- Add phone column to profiles table for user's direct phone number
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;