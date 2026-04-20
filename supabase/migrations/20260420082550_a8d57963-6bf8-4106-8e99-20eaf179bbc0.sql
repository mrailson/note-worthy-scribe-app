CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('notewell-notes-backstop','process-meeting-notes-queue','process-notes-queue') LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'notewell-notes-backstop',
  '*/10 * * * *',
  $cron$
  WITH stuck AS (
    SELECT m.id AS meeting_id
    FROM public.meetings m
    LEFT JOIN public.meeting_notes_multi mn ON mn.meeting_id = m.id
    WHERE m.created_at < now() - interval '15 minutes'
      AND m.created_at > now() - interval '7 days'
      AND coalesce(length(m.best_of_all_transcript), length(m.whisper_transcript_text), length(m.assembly_transcript_text), 0) > 200
      AND mn.id IS NULL
    LIMIT 5
  )
  SELECT net.http_post(
    url := 'https://dphcnbricafkbtizkoal.supabase.co/functions/v1/auto-generate-meeting-notes',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs"}'::jsonb,
    body := jsonb_build_object('meetingId', stuck.meeting_id, 'forceRegenerate', true, 'source', 'backstop-cron')
  )
  FROM stuck;
  $cron$
);