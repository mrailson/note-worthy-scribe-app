-- Add missing rate columns to staff_members table
ALTER TABLE public.staff_members 
ADD COLUMN IF NOT EXISTS gp_onsite_rate DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS gp_remote_rate DECIMAL(8,2);