-- Schedule background transcript cleaner to run every 2 hours
SELECT cron.schedule(
  'background-transcript-cleaner',
  '0 */2 * * *', -- Every 2 hours
  $$
  SELECT
    net.http_post(
        url:='https://dphcnbricafkbtizkoal.supabase.co/functions/v1/background-transcript-cleaner',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs"}'::jsonb,
        body:=concat('{"batchSize": 10, "scheduledRun": true, "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);