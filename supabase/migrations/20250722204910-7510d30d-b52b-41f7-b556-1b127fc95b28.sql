-- Create comprehensive audit logging system for NHS compliance
-- This ensures all data access and modifications are logged

-- Create audit log table for all system activities
CREATE TABLE IF NOT EXISTS public.system_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE, SELECT
  record_id UUID,
  user_id UUID NOT NULL,
  user_email TEXT,
  practice_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Enable RLS on audit log
ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies for audit log access
CREATE POLICY "System admins can view all audit logs" 
ON public.system_audit_log 
FOR SELECT 
USING (is_system_admin());

CREATE POLICY "Practice managers can view audit logs for their practice" 
ON public.system_audit_log 
FOR SELECT 
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) AND 
  practice_id = get_practice_manager_practice_id()
);

CREATE POLICY "Users can view their own audit logs" 
ON public.system_audit_log 
FOR SELECT 
USING (user_id = auth.uid());

-- Create policy for system to insert audit logs
CREATE POLICY "System can insert audit logs" 
ON public.system_audit_log 
FOR INSERT 
WITH CHECK (true); -- Allow system to log all operations

-- Create audit logging function
CREATE OR REPLACE FUNCTION public.log_system_activity(
  p_table_name TEXT,
  p_operation TEXT,
  p_record_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  log_id UUID;
  user_practice_id UUID;
BEGIN
  -- Get user's practice ID
  SELECT practice_id INTO user_practice_id
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Insert audit log entry
  INSERT INTO public.system_audit_log (
    table_name,
    operation,
    record_id,
    user_id,
    user_email,
    practice_id,
    old_values,
    new_values,
    timestamp
  ) VALUES (
    p_table_name,
    p_operation,
    p_record_id,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    auth.email(),
    user_practice_id,
    p_old_values,
    p_new_values,
    now()
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_audit_log_user_id ON public.system_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_practice_id ON public.system_audit_log(practice_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_timestamp ON public.system_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_table_operation ON public.system_audit_log(table_name, operation);