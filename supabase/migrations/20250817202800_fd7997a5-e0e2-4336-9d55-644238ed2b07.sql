-- Create storage bucket for image processing
INSERT INTO storage.buckets (id, name, public) 
VALUES ('image-processing', 'image-processing', false);

-- Create RLS policies for image processing bucket
CREATE POLICY "Authenticated users can upload images for processing" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'image-processing' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view their own uploaded images" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'image-processing' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own uploaded images" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'image-processing' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create table to track image processing requests
CREATE TABLE IF NOT EXISTS public.image_processing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  original_image_path TEXT NOT NULL,
  processed_image_path TEXT,
  prompt TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'generation',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  openai_revised_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on the table
ALTER TABLE public.image_processing_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own image processing requests"
ON public.image_processing_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own image processing requests"
ON public.image_processing_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own image processing requests"
ON public.image_processing_requests FOR UPDATE
USING (auth.uid() = user_id);

-- Create function to auto-update timestamp
CREATE OR REPLACE FUNCTION public.update_image_processing_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_image_processing_requests_updated_at
BEFORE UPDATE ON public.image_processing_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_image_processing_requests_updated_at();