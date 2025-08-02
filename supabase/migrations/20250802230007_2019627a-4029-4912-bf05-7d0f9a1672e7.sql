-- Add audio backup support to meetings table
ALTER TABLE public.meetings 
ADD COLUMN audio_backup_path TEXT,
ADD COLUMN audio_backup_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN requires_audio_backup BOOLEAN DEFAULT FALSE;

-- Create storage bucket for meeting audio backups if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-audio-backups', 'meeting-audio-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the audio backup bucket
CREATE POLICY "Users can upload their meeting audio backups"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'meeting-audio-backups' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their meeting audio backups"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'meeting-audio-backups' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their meeting audio backups"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'meeting-audio-backups' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add index for better performance when querying meetings with audio backups
CREATE INDEX IF NOT EXISTS idx_meetings_audio_backup 
ON public.meetings(user_id, audio_backup_path) 
WHERE audio_backup_path IS NOT NULL;