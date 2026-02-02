-- Function to check if a user exists by email (queries auth.users safely)
CREATE OR REPLACE FUNCTION public.check_user_exists_by_email(email_param TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = lower(email_param)
  );
$$;

-- Restrict access - only service_role can execute this
REVOKE ALL ON FUNCTION public.check_user_exists_by_email FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_exists_by_email TO service_role;