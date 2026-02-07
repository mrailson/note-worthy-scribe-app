-- Add PowerPoint persistence columns to complaint_audio_overviews
ALTER TABLE public.complaint_audio_overviews
ADD COLUMN IF NOT EXISTS powerpoint_download_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS powerpoint_gamma_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS powerpoint_thumbnail_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS powerpoint_slide_count INTEGER DEFAULT NULL;