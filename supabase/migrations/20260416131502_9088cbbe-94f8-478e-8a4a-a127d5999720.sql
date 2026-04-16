
-- Ensure pg_net is enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that fires the edge function via pg_net
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
  -- Only fire when status transitions to 'uploaded' or 'queued'
  IF (TG_OP = 'INSERT' AND NEW.status IN ('uploaded', 'queued'))
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
         AND NEW.status IN ('uploaded', 'queued')) THEN

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

-- Attach trigger to meetings table
DROP TRIGGER IF EXISTS auto_transcribe_on_upload ON meetings;
CREATE TRIGGER auto_transcribe_on_upload
  AFTER INSERT OR UPDATE OF status ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_transcribe_meeting();
