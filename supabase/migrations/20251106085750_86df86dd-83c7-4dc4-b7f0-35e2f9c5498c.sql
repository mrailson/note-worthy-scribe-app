-- Add audio overview columns to meeting_overviews table
ALTER TABLE public.meeting_overviews 
ADD COLUMN IF NOT EXISTS audio_overview_url TEXT,
ADD COLUMN IF NOT EXISTS audio_overview_text TEXT,
ADD COLUMN IF NOT EXISTS audio_overview_duration INTEGER;

-- Create storage bucket for meeting audio overviews
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-audio-overviews',
  'meeting-audio-overviews',
  true,
  10485760, -- 10MB limit
  ARRAY['audio/mpeg', 'audio/mp3']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for meeting-audio-overviews bucket
CREATE POLICY "Users can view audio for their own meetings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'meeting-audio-overviews' 
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload audio for their own meetings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meeting-audio-overviews'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update audio for their own meetings"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'meeting-audio-overviews'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete audio for their own meetings"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'meeting-audio-overviews'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
  )
);