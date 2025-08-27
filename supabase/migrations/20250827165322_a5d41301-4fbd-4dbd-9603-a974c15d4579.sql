-- Set up cron job to run system monitoring every 5 minutes
SELECT cron.schedule(
  'system-monitoring-check',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://dphcnbricafkbtizkoal.supabase.co/functions/v1/system-monitoring',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs"}'::jsonb,
        body:=concat('{"triggered_by": "cron", "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);