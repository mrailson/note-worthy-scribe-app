-- Add title field to profiles table for storing user titles (Mr, Ms, Dr, etc.)
ALTER TABLE public.profiles 
ADD COLUMN title text;