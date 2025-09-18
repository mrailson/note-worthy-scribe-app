-- Create trigger to automatically log user sessions when users sign in
-- This will ensure all logins are recorded in the user_sessions table

-- First, let's create an improved handle_user_login function that works with auth triggers
CREATE OR REPLACE FUNCTION public.handle_user_login_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create session record for actual logins (not just profile updates)
  IF (TG_OP = 'UPDATE' AND OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at AND NEW.last_sign_in_at IS NOT NULL) 
     OR (TG_OP = 'INSERT' AND NEW.last_sign_in_at IS NOT NULL) THEN
    
    -- Insert a new session record when user logs in
    INSERT INTO public.user_sessions (
      user_id,
      session_id,
      login_time,
      last_activity,
      is_active,
      ip_address,
      user_agent
    ) VALUES (
      NEW.id,
      NEW.id::text || '-' || extract(epoch from now())::text,
      COALESCE(NEW.last_sign_in_at, now()),
      now(),
      true,
      null, -- IP will be updated by application if available
      null  -- User agent will be updated by application if available
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table to automatically create session records
DROP TRIGGER IF EXISTS on_auth_user_login_session ON auth.users;
CREATE TRIGGER on_auth_user_login_session
  BEFORE UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_login_auth();