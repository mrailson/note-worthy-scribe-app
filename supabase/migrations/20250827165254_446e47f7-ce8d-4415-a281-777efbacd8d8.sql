-- Create monitoring alerts table
CREATE TABLE IF NOT EXISTS public.monitoring_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('table_size', 'search_history', 'audit_logs', 'file_storage')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  message TEXT NOT NULL,
  current_value BIGINT NOT NULL,
  threshold_value BIGINT NOT NULL,
  details JSONB DEFAULT '{}',
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.monitoring_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "System admins can view monitoring alerts" 
ON public.monitoring_alerts 
FOR SELECT 
USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage monitoring alerts" 
ON public.monitoring_alerts 
FOR ALL 
USING (is_system_admin(auth.uid()));

-- Create index for performance
CREATE INDEX idx_monitoring_alerts_created_at ON public.monitoring_alerts(created_at DESC);
CREATE INDEX idx_monitoring_alerts_severity ON public.monitoring_alerts(severity);
CREATE INDEX idx_monitoring_alerts_type ON public.monitoring_alerts(alert_type);

-- Create system monitoring status table
CREATE TABLE IF NOT EXISTS public.system_monitoring_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  last_check_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_alerts INTEGER NOT NULL DEFAULT 0,
  critical_alerts INTEGER NOT NULL DEFAULT 0,
  warning_alerts INTEGER NOT NULL DEFAULT 0,
  system_status TEXT NOT NULL CHECK (system_status IN ('healthy', 'warning', 'critical')),
  check_details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for monitoring status
ALTER TABLE public.system_monitoring_status ENABLE ROW LEVEL SECURITY;

-- Create policies for monitoring status
CREATE POLICY "System admins can view monitoring status" 
ON public.system_monitoring_status 
FOR SELECT 
USING (is_system_admin(auth.uid()));

CREATE POLICY "System can insert monitoring status" 
ON public.system_monitoring_status 
FOR INSERT 
WITH CHECK (true);

-- Create trigger to update monitoring alerts updated_at
CREATE OR REPLACE FUNCTION update_monitoring_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_monitoring_alerts_updated_at
  BEFORE UPDATE ON public.monitoring_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_monitoring_alerts_updated_at();

-- Create function to get current monitoring status
CREATE OR REPLACE FUNCTION get_monitoring_dashboard()
RETURNS TABLE(
  total_active_alerts INTEGER,
  critical_alerts INTEGER,
  warning_alerts INTEGER,
  last_check TIMESTAMP WITH TIME ZONE,
  system_status TEXT,
  recent_alerts JSONB
) 
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH alert_counts AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical,
      COUNT(*) FILTER (WHERE severity = 'warning') as warning
    FROM monitoring_alerts 
    WHERE resolved_at IS NULL
  ),
  latest_status AS (
    SELECT last_check_at, system_status
    FROM system_monitoring_status 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  recent_alert_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'alert_type', alert_type,
        'severity', severity,
        'message', message,
        'created_at', created_at,
        'details', details
      ) ORDER BY created_at DESC
    ) as alerts
    FROM (
      SELECT * FROM monitoring_alerts 
      WHERE resolved_at IS NULL 
      ORDER BY created_at DESC 
      LIMIT 10
    ) recent
  )
  SELECT 
    COALESCE(ac.total, 0)::INTEGER,
    COALESCE(ac.critical, 0)::INTEGER,
    COALESCE(ac.warning, 0)::INTEGER,
    COALESCE(ls.last_check_at, now()),
    COALESCE(ls.system_status, 'unknown'),
    COALESCE(rad.alerts, '[]'::jsonb)
  FROM alert_counts ac
  CROSS JOIN latest_status ls
  CROSS JOIN recent_alert_data rad;
$$;