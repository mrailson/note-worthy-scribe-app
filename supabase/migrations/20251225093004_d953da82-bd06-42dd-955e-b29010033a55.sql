-- Add new role types for non-practice organisations
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lmc_user';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'federation_user';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'icb_user';