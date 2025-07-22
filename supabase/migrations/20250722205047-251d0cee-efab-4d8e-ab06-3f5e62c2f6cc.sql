-- Add session management and security controls for NHS compliance

-- Create user sessions tracking table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  logout_time TIMESTAMP WITH TIME ZONE,
  logout_reason TEXT, -- 'manual', 'timeout', 'forced', 'security'
  practice_id UUID,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Enable RLS on user sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for session management
CREATE POLICY "System admins can view all sessions" 
ON public.user_sessions 
FOR SELECT 
USING (is_system_admin());

CREATE POLICY "Practice managers can view sessions for their practice" 
ON public.user_sessions 
FOR SELECT 
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) AND 
  practice_id = get_practice_manager_practice_id()
);

CREATE POLICY "Users can view their own sessions" 
ON public.user_sessions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "System can manage sessions" 
ON public.user_sessions 
FOR ALL 
USING (true);

-- Create security configuration table
CREATE TABLE IF NOT EXISTS public.security_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_name TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default NHS security settings
INSERT INTO public.security_settings (setting_name, setting_value, description) VALUES
('session_timeout_minutes', '30', 'NHS recommended session timeout - 30 minutes of inactivity'),
('max_login_attempts', '5', 'Maximum failed login attempts before account lock'),
('password_min_length', '12', 'NHS minimum password length requirement'),
('force_password_change_days', '90', 'Force password change every 90 days (NHS policy)'),
('audit_retention_days', '2555', 'Keep audit logs for 7 years (NHS requirement)'),
('data_retention_default_days', '2555', 'Default data retention period (7 years NHS)'),
('require_mfa', 'false', 'Require multi-factor authentication'),
('allow_concurrent_sessions', 'false', 'Allow multiple concurrent sessions per user')
ON CONFLICT (setting_name) DO NOTHING;

-- Enable RLS on security settings
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for security settings
CREATE POLICY "Authenticated users can view security settings" 
ON public.security_settings 
FOR SELECT 
USING (true);

CREATE POLICY "System admins can manage security settings" 
ON public.security_settings 
FOR ALL 
USING (is_system_admin());

-- Create function to get security setting
CREATE OR REPLACE FUNCTION public.get_security_setting(setting_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT setting_value 
  FROM public.security_settings 
  WHERE setting_name = $1 AND is_active = true
  LIMIT 1;
$$;

-- Create function to check if session is valid
CREATE OR REPLACE FUNCTION public.is_session_valid(p_session_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  session_timeout_minutes INTEGER;
  last_activity_time TIMESTAMP WITH TIME ZONE;
  is_active_session BOOLEAN;
BEGIN
  -- Get session timeout setting
  session_timeout_minutes := get_security_setting('session_timeout_minutes')::INTEGER;
  
  -- Check if session exists and is active
  SELECT 
    us.last_activity,
    us.is_active
  INTO 
    last_activity_time,
    is_active_session
  FROM public.user_sessions us
  WHERE us.session_id = p_session_id;
  
  -- Return false if session not found or inactive
  IF last_activity_time IS NULL OR NOT is_active_session THEN
    RETURN false;
  END IF;
  
  -- Check if session has timed out
  IF last_activity_time < (NOW() - (session_timeout_minutes || ' minutes')::INTERVAL) THEN
    -- Mark session as inactive
    UPDATE public.user_sessions 
    SET is_active = false, 
        logout_time = NOW(),
        logout_reason = 'timeout'
    WHERE session_id = p_session_id;
    
    RETURN false;
  END IF;
  
  -- Update last activity
  UPDATE public.user_sessions 
  SET last_activity = NOW()
  WHERE session_id = p_session_id;
  
  RETURN true;
END;
$$;

-- Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_user_id UUID,
  p_details JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  log_id UUID;
BEGIN
  -- Log security event in audit log
  SELECT public.log_system_activity(
    'security_events',
    p_event_type,
    p_user_id,
    NULL,
    p_details
  ) INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON public.user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_practice_id ON public.user_sessions(practice_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON public.user_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_security_settings_name ON public.security_settings(setting_name);