-- Remove ai_4_pm_access column from user_roles table since it's no longer used
ALTER TABLE public.user_roles DROP COLUMN IF EXISTS ai_4_pm_access;