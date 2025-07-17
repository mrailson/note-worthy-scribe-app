-- Add logo and footer settings to practice_details table
ALTER TABLE public.practice_details 
ADD COLUMN logo_url TEXT,
ADD COLUMN footer_text TEXT,
ADD COLUMN show_page_numbers BOOLEAN DEFAULT true;

-- Create storage bucket for practice logos
INSERT INTO storage.buckets (id, name, public) VALUES ('practice-logos', 'practice-logos', true);

-- Create policies for practice logos storage
CREATE POLICY "Users can view practice logos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'practice-logos');

CREATE POLICY "Users can upload their own practice logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'practice-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own practice logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'practice-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own practice logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'practice-logos' AND auth.uid()::text = (storage.foldername(name))[1]);