-- Enable pg_cron and pg_net extensions for scheduled functions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule news fetching 3 times daily (8 AM, 1 PM, 6 PM UK time)
SELECT cron.schedule(
  'fetch-gp-news-morning',
  '0 8 * * *', -- 8 AM daily
  $$
  SELECT
    net.http_post(
        url:='https://dphcnbricafkbtizkoal.supabase.co/functions/v1/fetch-gp-news',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs"}'::jsonb,
        body:=concat('{"scheduled": true, "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'fetch-gp-news-afternoon',
  '0 13 * * *', -- 1 PM daily
  $$
  SELECT
    net.http_post(
        url:='https://dphcnbricafkbtizkoal.supabase.co/functions/v1/fetch-gp-news',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs"}'::jsonb,
        body:=concat('{"scheduled": true, "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'fetch-gp-news-evening',
  '0 18 * * *', -- 6 PM daily
  $$
  SELECT
    net.http_post(
        url:='https://dphcnbricafkbtizkoal.supabase.co/functions/v1/fetch-gp-news',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs"}'::jsonb,
        body:=concat('{"scheduled": true, "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);