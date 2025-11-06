-- Create complaint_audio_overviews table
CREATE TABLE public.complaint_audio_overviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL UNIQUE REFERENCES public.complaints(id) ON DELETE CASCADE,
  audio_overview_url TEXT,
  audio_overview_text TEXT,
  audio_overview_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_audio_overviews ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (same access as complaints)
CREATE POLICY "Users can view audio overviews for their complaints"
ON public.complaint_audio_overviews FOR SELECT
USING (
  complaint_id IN (
    SELECT id FROM public.complaints 
    WHERE practice_id = ANY(get_user_practice_ids(auth.uid()))
       OR created_by = auth.uid()
  )
  OR is_system_admin(auth.uid())
);

CREATE POLICY "Users can insert audio overviews for their complaints"
ON public.complaint_audio_overviews FOR INSERT
WITH CHECK (
  complaint_id IN (
    SELECT id FROM public.complaints 
    WHERE practice_id = ANY(get_user_practice_ids(auth.uid()))
       OR created_by = auth.uid()
  )
  OR is_system_admin(auth.uid())
);

CREATE POLICY "Users can update audio overviews for their complaints"
ON public.complaint_audio_overviews FOR UPDATE
USING (
  complaint_id IN (
    SELECT id FROM public.complaints 
    WHERE practice_id = ANY(get_user_practice_ids(auth.uid()))
       OR created_by = auth.uid()
  )
  OR is_system_admin(auth.uid())
);

-- Create storage bucket for complaint audio overviews
INSERT INTO storage.buckets (id, name, public) 
VALUES ('complaint-audio-overviews', 'complaint-audio-overviews', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Public can view complaint audio overviews"
ON storage.objects FOR SELECT
USING (bucket_id = 'complaint-audio-overviews');

CREATE POLICY "Authenticated users can upload complaint audio overviews"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'complaint-audio-overviews' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update complaint audio overviews"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'complaint-audio-overviews' 
  AND auth.role() = 'authenticated'
);

-- Create index for faster lookups
CREATE INDEX idx_complaint_audio_overviews_complaint_id 
ON public.complaint_audio_overviews(complaint_id);

-- Create trigger for updated_at
CREATE TRIGGER update_complaint_audio_overviews_updated_at
BEFORE UPDATE ON public.complaint_audio_overviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();