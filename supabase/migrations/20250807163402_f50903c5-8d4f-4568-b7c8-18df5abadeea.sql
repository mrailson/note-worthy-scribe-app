-- Fix Security Definer View and Function Search Path Issues

-- 1. Drop the problematic Security Definer View if it exists
DROP VIEW IF EXISTS public.accessible_meetings;

-- 2. Fix remaining functions missing search_path security
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_login = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

-- 3. Recreate accessible_meetings as a regular view (not SECURITY DEFINER)
CREATE VIEW public.accessible_meetings AS
SELECT 
  m.*,
  CASE 
    WHEN m.user_id = auth.uid() THEN 'owner'
    ELSE 'shared'
  END AS access_type,
  ms.shared_by,
  ms.shared_at,
  ms.access_level,
  ms.message AS share_message,
  ms.id AS share_id
FROM public.meetings m
LEFT JOIN public.meeting_shares ms ON m.id = ms.meeting_id
WHERE 
  m.user_id = auth.uid() OR -- Own meetings
  (ms.shared_with_user_id = auth.uid() OR ms.shared_with_email = auth.email()); -- Shared meetings