-- Enable real-time for monitoring alerts
ALTER TABLE public.monitoring_alerts REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.monitoring_alerts;