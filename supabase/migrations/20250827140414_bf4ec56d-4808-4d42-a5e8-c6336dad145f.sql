-- Create function to handle user login tracking
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    now(),
    now(),
    true,
    null, -- IP will be updated by application if available
    null  -- User agent will be updated by application if available
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically log user sessions on auth
CREATE OR REPLACE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_user_login();

-- Create function to update user session activity
CREATE OR REPLACE FUNCTION public.update_user_session_activity(
  p_user_id uuid,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the most recent active session for this user
  UPDATE public.user_sessions 
  SET 
    last_activity = now(),
    ip_address = COALESCE(p_ip_address, ip_address),
    user_agent = COALESCE(p_user_agent, user_agent)
  WHERE user_id = p_user_id 
    AND is_active = true
    AND login_time = (
      SELECT MAX(login_time) 
      FROM public.user_sessions 
      WHERE user_id = p_user_id AND is_active = true
    );
END;
$$;

-- Create some sample data for testing purposes (this will be removed in production)
-- Insert sample session data for existing users to demonstrate the functionality
INSERT INTO public.user_sessions (
  user_id,
  session_id,
  login_time,
  last_activity,
  is_active,
  ip_address,
  user_agent
) 
SELECT 
  id as user_id,
  id::text || '-sample-' || extract(epoch from now())::text as session_id,
  COALESCE(last_sign_in_at, created_at) as login_time,
  COALESCE(last_sign_in_at, created_at) as last_activity,
  false as is_active, -- Mark as inactive since these are historical
  '192.168.1.1'::inet as ip_address,
  'Sample User Agent' as user_agent
FROM auth.users
WHERE id NOT IN (SELECT DISTINCT user_id FROM public.user_sessions)
ON CONFLICT DO NOTHING;

-- Also create a more recent "active" session for each user
INSERT INTO public.user_sessions (
  user_id,
  session_id,
  login_time,
  last_activity,
  is_active,
  ip_address,
  user_agent
) 
SELECT 
  id as user_id,
  id::text || '-current-' || extract(epoch from now())::text as session_id,
  now() - interval '1 hour' as login_time,
  now() - interval '5 minutes' as last_activity,
  true as is_active,
  '192.168.1.100'::inet as ip_address,
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0' as user_agent
FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM public.user_sessions WHERE is_active = true
)
ON CONFLICT DO NOTHING;