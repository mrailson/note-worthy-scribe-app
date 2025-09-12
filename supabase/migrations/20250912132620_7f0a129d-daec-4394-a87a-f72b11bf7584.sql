-- Fix security vulnerability: Restrict access to user_sessions table
-- Drop the overly permissive policy that allows anyone to manage sessions
DROP POLICY IF EXISTS "System can manage sessions" ON public.user_sessions;

-- Create security function to log session access attempts
CREATE OR REPLACE FUNCTION public.log_session_access_attempt(p_session_id text, p_access_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Log security event for session access attempts
  PERFORM public.log_security_event(
    'session_access_attempt',
    'medium',
    auth.uid(),
    auth.email(),
    NULL,
    NULL,
    jsonb_build_object(
      'session_id', p_session_id,
      'access_type', p_access_type,
      'timestamp', now()
    )
  );
END;
$$;

-- Create secure RLS policies for user_sessions

-- Policy 1: Users can only view their own sessions
CREATE POLICY "Users can view own sessions" 
ON public.user_sessions 
FOR SELECT 
USING (user_id = auth.uid());

-- Policy 2: Users can only insert their own sessions
CREATE POLICY "Users can insert own sessions" 
ON public.user_sessions 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Policy 3: Users can only update their own sessions
CREATE POLICY "Users can update own sessions" 
ON public.user_sessions 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy 4: Users can only delete their own sessions
CREATE POLICY "Users can delete own sessions" 
ON public.user_sessions 
FOR DELETE 
USING (user_id = auth.uid());

-- Policy 5: System admins can manage all sessions
CREATE POLICY "System admins can manage all sessions" 
ON public.user_sessions 
FOR ALL 
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Policy 6: Practice managers can view sessions for their practice users
CREATE POLICY "Practice managers can view practice user sessions" 
ON public.user_sessions 
FOR SELECT 
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) AND
  user_id IN (
    SELECT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.practice_id = get_practice_manager_practice_id()
  )
);

-- Add comment explaining the security fix
COMMENT ON TABLE public.user_sessions IS 'User session data with RLS policies to prevent unauthorized access to sensitive session information including IP addresses, user agents, and session tokens.';