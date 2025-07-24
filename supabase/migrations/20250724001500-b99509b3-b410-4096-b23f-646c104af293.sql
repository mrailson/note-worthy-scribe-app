-- Add AI4PM access column to user_roles table
ALTER TABLE public.user_roles ADD COLUMN ai_4_pm_access boolean DEFAULT false;