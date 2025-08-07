-- Add mic test service visibility setting to profiles table
ALTER TABLE public.profiles ADD COLUMN mic_test_service_visible boolean NOT NULL DEFAULT true;