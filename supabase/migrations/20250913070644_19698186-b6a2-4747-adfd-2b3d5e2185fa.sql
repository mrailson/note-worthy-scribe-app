-- Create security events table for NHS compliance audit trail
CREATE TABLE public.security_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  ip_address inet,
  user_agent text,
  event_details jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "System admins can view all security events" 
ON public.security_events 
FOR SELECT 
USING (is_system_admin(auth.uid()));

CREATE POLICY "System can insert security events" 
ON public.security_events 
FOR INSERT 
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_security_events_type_severity ON public.security_events(event_type, severity);
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX idx_security_events_created_at ON public.security_events(created_at DESC);

-- Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_severity text DEFAULT 'medium',
  p_user_id uuid DEFAULT NULL,
  p_user_email text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_event_details jsonb DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;