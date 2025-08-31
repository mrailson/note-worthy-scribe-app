-- Add missing columns to meeting_notes_queue table for proper error handling and retries
ALTER TABLE public.meeting_notes_queue 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_meeting_notes_queue_status_retry ON public.meeting_notes_queue(status, retry_count, created_at);

-- Set up cron job to process the queue every 2 minutes
SELECT cron.schedule(
    'process-meeting-notes-queue',
    '*/2 * * * *', -- every 2 minutes
    $$
    SELECT net.http_post(
        url:='https://dphcnbricafkbtizkoal.supabase.co/functions/v1/process-meeting-notes-queue',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjczMjIzMiwiZXhwIjoyMDY4MzA4MjMyfQ.dIJzcLw6ufPyrA1VCiJdJ-EIpwYZn4gFKg5nX0NVLyo"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
    $$
);

-- Trigger the queue processor immediately for the current meeting
DO $$
BEGIN
    PERFORM net.http_post(
        url => 'https://dphcnbricafkbtizkoal.supabase.co/functions/v1/process-meeting-notes-queue',
        headers => '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjczMjIzMiwiZXhwIjoyMDY4MzA4MjMyfQ.dIJzcLw6ufPyrA1VCiJdJ-EIpwYZn4gFKg5nX0NVLyo"}'::jsonb,
        body => '{"source": "manual_trigger"}'::jsonb
    );
END $$;