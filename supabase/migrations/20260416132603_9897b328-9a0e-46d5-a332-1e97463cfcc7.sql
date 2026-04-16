
-- Update the trigger function to use correct status values
CREATE OR REPLACE FUNCTION public.trigger_transcribe_meeting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url TEXT;
  _anon_key TEXT;
BEGIN
  -- Fire when status transitions to 'pending_transcription' or 'queued' (the actual mobile statuses)
  IF (TG_OP = 'INSERT' AND NEW.status IN ('pending_transcription', 'queued'))
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
         AND NEW.status IN ('pending_transcription', 'queued')) THEN

    _url := 'https://dphcnbricafkbtizkoal.supabase.co/functions/v1/transcribe-offline-meeting';
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs';

    PERFORM net.http_post(
      url := _url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object('meetingId', NEW.id, 'chunkIndex', 0)
    );
  END IF;

  RETURN NEW;
END $$;

-- Re-attach trigger (unchanged, just ensures it uses the updated function)
DROP TRIGGER IF EXISTS auto_transcribe_on_upload ON meetings;
CREATE TRIGGER auto_transcribe_on_upload
  AFTER INSERT OR UPDATE OF status ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_transcribe_meeting();

-- Remove the old cron job and re-create with correct statuses
SELECT cron.unschedule('auto-process-stuck-meetings');

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
      WHERE status IN ('pending_transcription', 'queued')
        AND created_at < NOW() - INTERVAL '2 minutes'
        AND created_at > NOW() - INTERVAL '24 hours'
        AND import_source IN ('mobile_offline', 'mobile_live')
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
