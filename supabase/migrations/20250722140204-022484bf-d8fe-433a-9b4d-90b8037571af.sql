-- First migration: Add new role enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'complaints_manager';

-- Commit this change
COMMIT;