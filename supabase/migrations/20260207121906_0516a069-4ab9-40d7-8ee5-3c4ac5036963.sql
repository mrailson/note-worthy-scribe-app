-- Create storage bucket for complaint infographics
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-infographics', 'complaint-infographics', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for complaint-infographics bucket
CREATE POLICY "Authenticated users can upload infographics"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'complaint-infographics' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read infographics"
ON storage.objects FOR SELECT
USING (bucket_id = 'complaint-infographics' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update infographics"
ON storage.objects FOR UPDATE
USING (bucket_id = 'complaint-infographics' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete infographics"
ON storage.objects FOR DELETE
USING (bucket_id = 'complaint-infographics' AND auth.role() = 'authenticated');

-- Add infographic URL column to complaint_audio_overviews table
ALTER TABLE public.complaint_audio_overviews
ADD COLUMN IF NOT EXISTS infographic_url TEXT DEFAULT NULL;