-- Second migration: Add receptionist role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';