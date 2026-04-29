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

  -- Only fire for mobile recordings and imported transcripts/audio
  IF v_import_source IS NULL OR v_import_source NOT IN ('mobile_offline', 'mobile_live', 'transcript_import', 'audio_import') THEN
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