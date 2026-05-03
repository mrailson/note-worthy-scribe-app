
ALTER TABLE public.pipeline_test_runs
  ADD COLUMN IF NOT EXISTS docx_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS custom_test BOOLEAN NOT NULL DEFAULT false;

-- Update email trigger to also fire for pipeline_test_custom
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

  IF v_import_source IS NULL OR v_import_source NOT IN ('mobile_offline', 'mobile_live', 'transcript_import', 'audio_import', 'pipeline_test', 'pipeline_test_custom') THEN
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

-- Create private bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pipeline-test-artifacts', 'pipeline-test-artifacts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "users_read_own_pipeline_artifacts" ON storage.objects;
CREATE POLICY "users_read_own_pipeline_artifacts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pipeline-test-artifacts' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "users_write_own_pipeline_artifacts" ON storage.objects;
CREATE POLICY "users_write_own_pipeline_artifacts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pipeline-test-artifacts' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "users_update_own_pipeline_artifacts" ON storage.objects;
CREATE POLICY "users_update_own_pipeline_artifacts"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'pipeline-test-artifacts' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "users_delete_own_pipeline_artifacts" ON storage.objects;
CREATE POLICY "users_delete_own_pipeline_artifacts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pipeline-test-artifacts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Service role uploads for the deliver-mobile-meeting-email function
DROP POLICY IF EXISTS "service_role_pipeline_artifacts" ON storage.objects;
CREATE POLICY "service_role_pipeline_artifacts"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'pipeline-test-artifacts')
  WITH CHECK (bucket_id = 'pipeline-test-artifacts');
