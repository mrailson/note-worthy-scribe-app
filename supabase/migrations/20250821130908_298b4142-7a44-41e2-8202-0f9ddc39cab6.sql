-- Set up the cron job to process pending notes every 2 minutes
SELECT cron.schedule(
  'process-pending-auto-notes',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dphcnbricafkbtizkoal.supabase.co/functions/v1/process-pending-auto-notes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjczMjIzMiwiZXhwIjoyMDY4MzA4MjMyfQ.vcvFJxkGFDz_WqRTgPMJCNNgcMBvQ5HfLV8iCjzItag"}'::jsonb,
    body := '{"manual_trigger": true}'::jsonb
  );
  $$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-pending-auto-notes'
);

-- Also manually trigger the function now to process your specific meeting
SELECT net.http_post(
  url := 'https://dphcnbricafkbtizkoal.supabase.co/functions/v1/process-pending-auto-notes',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjczMjIzMiwiZXhwIjoyMDY4MzA4MjMyfQ.vcvFJxkGFDz_WqRTgPMJCNNgcMBvQ5HfLV8iCjzItag"}'::jsonb,
  body := '{"manual_trigger": true}'::jsonb
);