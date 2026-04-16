
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule the safety-net job
SELECT cron.schedule(
  'auto-process-stuck-meetings',
  '*/2 * * * *',
  $$
  DO $cron$
  DECLARE
    m RECORD;
    _url TEXT := 'https://dphcnbricafkbtizkoal.supabase.co/functions/v1/transcribe-offline-meeting';
    _anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs';
  BEGIN
    FOR m IN
      SELECT id FROM meetings
      WHERE status IN ('queued', 'uploaded')
        AND created_at < NOW() - INTERVAL '2 minutes'
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 10
    LOOP
      PERFORM net.http_post(
        url := _url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _anon_key
        ),
        body := jsonb_build_object('meetingId', m.id, 'chunkIndex', 0)
      );
    END LOOP;
  END $cron$;
  $$
);
