-- Add new columns to meetings table
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS upload_session_id TEXT,
  ADD COLUMN IF NOT EXISTS remote_chunk_paths TEXT[],
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER,
  ADD COLUMN IF NOT EXISTS notes_email_sent_at TIMESTAMPTZ;

-- Create trigger function to auto-deliver email on mobile meeting summary insert
CREATE OR REPLACE FUNCTION public.trigger_deliver_mobile_meeting_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_import_source TEXT;
BEGIN
  -- Look up the meeting's import source
  SELECT import_source INTO v_import_source
  FROM public.meetings
  WHERE id = NEW.meeting_id;

  -- Only fire for mobile recordings
  IF v_import_source IS NULL OR v_import_source NOT IN ('mobile_offline', 'mobile_live') THEN
    RETURN NEW;
  END IF;

  -- Call the edge function via pg_net (same pattern as existing cron jobs)
  PERFORM net.http_post(
    url := 'https://dphcnbricafkbtizkoal.supabase.co/functions/v1/deliver-mobile-meeting-email',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs"}'::jsonb,
    body := jsonb_build_object('meetingId', NEW.meeting_id::text)
  );

  RETURN NEW;
END;
$$;

-- Create the trigger on meeting_summaries
DROP TRIGGER IF EXISTS trg_deliver_mobile_meeting_email ON public.meeting_summaries;
CREATE TRIGGER trg_deliver_mobile_meeting_email
  AFTER INSERT ON public.meeting_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_deliver_mobile_meeting_email();