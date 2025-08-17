-- Fix remaining critical security issues - avoiding policy conflicts

-- Check if policies exist and drop conflicting ones, then recreate
DROP POLICY IF EXISTS "Practice managers can manage staff members" ON public.staff_members;
DROP POLICY IF EXISTS "Authenticated users can view staff members" ON public.staff_members;

-- Add RLS policy to staff_members table to require authentication  
CREATE POLICY "Staff members require authentication"
ON public.staff_members
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff members management by authorized users"
ON public.staff_members
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- Add RLS policies to contractors table if not exists
DROP POLICY IF EXISTS "Authorized users can view contractors" ON public.contractors;
DROP POLICY IF EXISTS "Authorized users can manage contractors" ON public.contractors;

CREATE POLICY "Contractors require authenticated view"
ON public.contractors
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Contractors management by authorized users"
ON public.contractors
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- Add comprehensive input validation function
CREATE OR REPLACE FUNCTION public.validate_input_security(input_text text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Check for potential SQL injection patterns
  IF input_text ~* '(drop|delete|insert|update|alter|create|exec|execute|script|javascript|<script|onload|onerror)' THEN
    -- Log security event
    INSERT INTO public.security_events (
      event_type,
      severity,
      user_id,
      user_email,
      event_details
    ) VALUES (
      'MALICIOUS_INPUT_DETECTED',
      'high',
      auth.uid(),
      auth.email(),
      jsonb_build_object(
        'input_text', left(input_text, 100),
        'timestamp', now(),
        'detection_rule', 'sql_injection_keywords'
      )
    );
    
    RETURN false;
  END IF;
  
  -- Check for excessively long input (potential buffer overflow)
  IF length(input_text) > 10000 THEN
    INSERT INTO public.security_events (
      event_type,
      severity,
      user_id,
      user_email,
      event_details
    ) VALUES (
      'SUSPICIOUS_INPUT_LENGTH',
      'medium',
      auth.uid(),
      auth.email(),
      jsonb_build_object(
        'input_length', length(input_text),
        'timestamp', now()
      )
    );
    
    RETURN false;
  END IF;
  
  RETURN true;
END;
$function$;

-- Add session monitoring function
CREATE OR REPLACE FUNCTION public.monitor_user_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_session_count INTEGER;
  max_concurrent_sessions INTEGER := 5;
BEGIN
  -- Count current active sessions for this user
  SELECT COUNT(*) INTO current_session_count
  FROM public.user_sessions
  WHERE user_id = NEW.user_id 
    AND is_active = true
    AND last_activity > (NOW() - interval '1 hour');
  
  -- If too many concurrent sessions, log security event
  IF current_session_count > max_concurrent_sessions THEN
    INSERT INTO public.security_events (
      event_type,
      severity,
      user_id,
      user_email,
      event_details
    ) VALUES (
      'EXCESSIVE_CONCURRENT_SESSIONS',
      'high',
      NEW.user_id,
      auth.email(),
      jsonb_build_object(
        'concurrent_sessions', current_session_count,
        'max_allowed', max_concurrent_sessions,
        'timestamp', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Add data export monitoring
CREATE OR REPLACE FUNCTION public.log_data_export_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Log when sensitive data exports occur
  INSERT INTO public.security_events (
    event_type,
    severity,
    user_id,
    user_email,
    event_details
  ) VALUES (
    'DATA_EXPORT',
    'medium',
    auth.uid(),
    auth.email(),
    jsonb_build_object(
      'exported_table', TG_TABLE_NAME,
      'export_type', 'database_query',
      'timestamp', now(),
      'user_id', auth.uid()
    )
  );
  
  RETURN NEW;
END;
$function$;