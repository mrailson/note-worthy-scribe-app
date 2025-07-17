-- Add meeting retention policy to profiles table
ALTER TABLE public.profiles 
ADD COLUMN meeting_retention_policy text DEFAULT 'forever' CHECK (meeting_retention_policy IN ('forever', 'after_email', '1_week', '1_month', '1_year'));