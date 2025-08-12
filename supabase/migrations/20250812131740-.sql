-- Ensure storage bucket exists for meeting audio backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-audio-backups', 'meeting-audio-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies to allow users to manage their own files within their user-id folder
DO $$
BEGIN
  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own meeting backups (folder)'
  ) THEN
    CREATE POLICY "Users can upload their own meeting backups (folder)"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'meeting-audio-backups' 
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  -- SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view their own meeting backups (folder)'
  ) THEN
    CREATE POLICY "Users can view their own meeting backups (folder)"
    ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'meeting-audio-backups' 
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  -- DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own meeting backups (folder)'
  ) THEN
    CREATE POLICY "Users can delete their own meeting backups (folder)"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'meeting-audio-backups' 
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Relax RLS to allow users to manage their own backup metadata safely
ALTER TABLE public.meeting_audio_backups ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own backup metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'meeting_audio_backups' AND policyname = 'Users can insert their own backups'
  ) THEN
    CREATE POLICY "Users can insert their own backups"
    ON public.meeting_audio_backups
    FOR INSERT
    WITH CHECK (user_id = auth.uid());
  END IF;

  -- Allow users to view their own backups, or backups linked to meetings they can access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'meeting_audio_backups' AND policyname = 'Users can view their own backups or accessible meetings'
  ) THEN
    CREATE POLICY "Users can view their own backups or accessible meetings"
    ON public.meeting_audio_backups
    FOR SELECT
    USING (
      user_id = auth.uid()
      OR (meeting_id IS NOT NULL AND public.user_has_meeting_access(meeting_id, auth.uid()))
    );
  END IF;

  -- Allow users to update their own backups (e.g., link to meeting)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'meeting_audio_backups' AND policyname = 'Users can update their own backups'
  ) THEN
    CREATE POLICY "Users can update their own backups"
    ON public.meeting_audio_backups
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;