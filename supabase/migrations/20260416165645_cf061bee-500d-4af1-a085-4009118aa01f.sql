-- Reschedule cron #1: auto-process-stuck-meetings with processing lock
SELECT cron.unschedule('auto-process-stuck-meetings');

SELECT cron.schedule(
  'auto-process-stuck-meetings',
  '*/2 * * * *',
  $$
  DO $cron$
  DECLARE
    m RECORD;
  BEGIN
    FOR m IN
      SELECT id FROM public.meetings
      WHERE status IN ('queued', 'uploaded')
        AND created_at < NOW() - INTERVAL '2 minutes'
        AND created_at > NOW() - INTERVAL '24 hours'
        AND COALESCE(retry_count, 0) < 5
        AND (processing_started_at IS NULL OR processing_started_at <= NOW() - INTERVAL '10 minutes')
      ORDER BY created_at ASC
      LIMIT 10
    LOOP
      UPDATE public.meetings
        SET retry_count = COALESCE(retry_count, 0) + 1,
            last_retry_at = NOW(),
            processing_started_at = NOW()
        WHERE id = m.id;

      PERFORM net.http_post(
        url := 'https://dphcnbricafkbtizkoal.supabase.co/functions/v1/transcribe-offline-meeting',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs"}'::jsonb,
        body := jsonb_build_object('meetingId', m.id)
      );
    END LOOP;

    UPDATE public.meetings
      SET status = 'failed_permanent',
          error_reason = 'Exceeded 5 transcription retries. Manual intervention needed.'
      WHERE status IN ('queued', 'uploaded')
        AND retry_count >= 5;
  END $cron$;
  $$
);

-- Reschedule cron #2: complete-stuck-meetings-post-transcription with processing lock
SELECT cron.unschedule('complete-stuck-meetings-post-transcription');

SELECT cron.schedule(
  'complete-stuck-meetings-post-transcription',
  '*/3 * * * *',
  $$
  DO $cron$
  DECLARE
    m RECORD;
  BEGIN
    FOR m IN
      SELECT id FROM public.meetings
      WHERE word_count > 0
        AND status NOT IN ('recording', 'live', 'in_progress', 'uploading', 'queued', 'uploaded')
        AND (
          notes_generation_status IS NULL
          OR notes_generation_status IN ('not_started', 'failed')
          OR notes_email_sent_at IS NULL
          OR title ~ '^Meeting \d{1,2} \w{3} \d{1,2}:\d{2}$'
        )
        AND COALESCE(transcript_updated_at, updated_at) < NOW() - INTERVAL '10 minutes'
        AND created_at > NOW() - INTERVAL '24 hours'
        AND COALESCE(retry_count, 0) < 5
        AND (processing_started_at IS NULL OR processing_started_at <= NOW() - INTERVAL '10 minutes')
      ORDER BY created_at ASC
      LIMIT 10
    LOOP
      UPDATE public.meetings
        SET retry_count = COALESCE(retry_count, 0) + 1,
            last_retry_at = NOW(),
            processing_started_at = NOW()
        WHERE id = m.id;

      PERFORM net.http_post(
        url := 'https://dphcnbricafkbtizkoal.supabase.co/functions/v1/complete-stuck-meeting',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs"}'::jsonb,
        body := jsonb_build_object('meetingId', m.id)
      );
    END LOOP;
  END $cron$;
  $$
);