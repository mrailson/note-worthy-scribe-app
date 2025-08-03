-- Create security events table for monitoring
CREATE TABLE public.security_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID,
  user_email TEXT,
  ip_address INET,
  user_agent TEXT,
  event_details JSONB DEFAULT '{}',
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "System admins can view all security events" 
ON public.security_events 
FOR SELECT 
USING (is_system_admin());

CREATE POLICY "System can insert security events" 
ON public.security_events 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System admins can update security events" 
ON public.security_events 
FOR UPDATE 
USING (is_system_admin());

-- Create indexes for performance
CREATE INDEX idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_severity ON public.security_events(severity);
CREATE INDEX idx_security_events_timestamp ON public.security_events(event_timestamp DESC);
CREATE INDEX idx_security_events_ip_address ON public.security_events(ip_address);
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);

-- Create function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_severity TEXT DEFAULT 'medium',
  p_user_id UUID DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_event_details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.security_events (
    event_type,
    severity,
    user_id,
    user_email,
    ip_address,
    user_agent,
    event_details
  ) VALUES (
    p_event_type,
    p_severity,
    p_user_id,
    p_user_email,
    p_ip_address,
    p_user_agent,
    p_event_details
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample security events for demonstration
INSERT INTO public.security_events (event_type, severity, user_email, ip_address, event_details) VALUES
('failed_login_attempt', 'medium', 'unknown@suspicious.com', '192.168.1.100', '{"attempt_count": 3, "reason": "invalid_password"}'),
('suspicious_api_access', 'high', 'user@test.com', '10.0.0.1', '{"endpoint": "/api/admin", "status": 403, "unusual_pattern": true}'),
('account_lockout', 'high', 'admin@practice.com', '172.16.0.1', '{"lockout_reason": "multiple_failed_attempts", "attempt_count": 5}'),
('unauthorized_data_access', 'critical', 'guest@unknown.com', '203.0.113.1', '{"table": "complaints", "action": "SELECT", "blocked": true}'),
('password_reset_request', 'low', 'user@practice.com', '192.168.1.50', '{"request_method": "email", "valid_user": true}'),
('role_permission_change', 'medium', 'admin@system.com', '10.0.0.100', '{"target_user": "staff@practice.com", "old_role": "user", "new_role": "admin"}');

-- Create trigger to update system audit log for security events
CREATE OR REPLACE FUNCTION notify_security_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log high and critical severity events to system audit
  IF NEW.severity IN ('high', 'critical') THEN
    INSERT INTO system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      user_email,
      new_values,
      ip_address
    ) VALUES (
      'security_events',
      'SECURITY_ALERT',
      NEW.id,
      NEW.user_id,
      NEW.user_email,
      row_to_json(NEW),
      NEW.ip_address
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_event_audit_trigger
  AFTER INSERT ON public.security_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_security_event();