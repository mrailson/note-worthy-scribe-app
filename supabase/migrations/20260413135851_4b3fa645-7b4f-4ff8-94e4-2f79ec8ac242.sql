
-- Enable extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Add columns to meeting_notes_queue if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meeting_notes_queue' AND column_name = 'retry_count') THEN
    ALTER TABLE public.meeting_notes_queue ADD COLUMN retry_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meeting_notes_queue' AND column_name = 'note_type') THEN
    ALTER TABLE public.meeting_notes_queue ADD COLUMN note_type text DEFAULT 'standard';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meeting_notes_queue' AND column_name = 'batch_id') THEN
    ALTER TABLE public.meeting_notes_queue ADD COLUMN batch_id uuid;
  END IF;
END $$;

-- Add index for efficient pending queue processing
CREATE INDEX IF NOT EXISTS idx_meeting_notes_queue_pending_retry
  ON public.meeting_notes_queue (status, retry_count, created_at)
  WHERE status = 'pending' AND retry_count < 3;

-- Add index for orphan meeting detection
CREATE INDEX IF NOT EXISTS idx_meetings_orphan_detection
  ON public.meetings (status, notes_generation_status, updated_at)
  WHERE status = 'completed' AND notes_generation_status IN ('not_started', 'queued', 'failed');
