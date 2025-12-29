-- Rename 'user' role to 'practice_user' in app_role enum
ALTER TYPE public.app_role RENAME VALUE 'user' TO 'practice_user';