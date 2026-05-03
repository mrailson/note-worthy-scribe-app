
-- Pipeline test results table
CREATE TABLE IF NOT EXISTS public.pipeline_test_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_size TEXT NOT NULL CHECK (test_size IN ('short', 'medium', 'long')),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  transcript_chars INTEGER NOT NULL,
  transcript_words INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meeting_inserted_at TIMESTAMPTZ,
  transcript_inserted_at TIMESTAMPTZ,
  notes_invoked_at TIMESTAMPTZ,
  notes_status_generating_at TIMESTAMPTZ,
  notes_first_delta_at TIMESTAMPTZ,
  notes_completed_at TIMESTAMPTZ,
  summary_inserted_at TIMESTAMPTZ,
  email_triggered_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
  notes_model_used TEXT,
  notes_path TEXT,
  notes_chars INTEGER,
  action_count INTEGER,
  email_recipient TEXT,
  error_message TEXT,
  diagnostic_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_test_runs_user_id ON public.pipeline_test_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_test_runs_started_at ON public.pipeline_test_runs(started_at DESC);

ALTER TABLE public.pipeline_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_pipeline_runs" ON public.pipeline_test_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_pipeline_runs" ON public.pipeline_test_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_pipeline_runs" ON public.pipeline_test_runs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_pipeline_runs" ON public.pipeline_test_runs
  FOR DELETE USING (auth.uid() = user_id);

-- Add notes_first_delta_at column to meetings for first-token timing
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS notes_first_delta_at TIMESTAMPTZ;

-- Update the email trigger to also fire for pipeline_test imports
CREATE OR REPLACE FUNCTION public.trigger_deliver_mobile_meeting_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_import_source TEXT;
BEGIN
  SELECT import_source INTO v_import_source
  FROM public.meetings
  WHERE id = NEW.meeting_id;

  IF v_import_source IS NULL OR v_import_source NOT IN ('mobile_offline', 'mobile_live', 'transcript_import', 'audio_import', 'pipeline_test') THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://dphcnbricafkbtizkoal.supabase.co/functions/v1/deliver-mobile-meeting-email',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs"}'::jsonb,
    body := jsonb_build_object('meetingId', NEW.meeting_id::text)
  );

  RETURN NEW;
END;
$function$;
