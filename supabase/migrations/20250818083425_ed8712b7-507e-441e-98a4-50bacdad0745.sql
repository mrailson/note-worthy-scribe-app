-- Create storage buckets for signatures and practice logos
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('practice-logos', 'practice-logos', true);

-- Create RLS policies for signatures (private)
CREATE POLICY "Users can view their own signatures" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own signatures" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own signatures" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own signatures" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create RLS policies for practice logos (public read, restricted write)
CREATE POLICY "Practice logos are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'practice-logos');

CREATE POLICY "Users can upload practice logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'practice-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their practice logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'practice-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their practice logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'practice-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add signature_url and logo_url fields to practice_details table
ALTER TABLE public.practice_details 
ADD COLUMN signature_url text,
ADD COLUMN practice_logo_url text;