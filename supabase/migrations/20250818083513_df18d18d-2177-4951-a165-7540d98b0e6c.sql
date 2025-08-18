-- Create signatures bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false)
ON CONFLICT (id) DO NOTHING;

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

-- Add signature_url and practice_logo_url fields to practice_details table
ALTER TABLE public.practice_details 
ADD COLUMN IF NOT EXISTS signature_url text,
ADD COLUMN IF NOT EXISTS practice_logo_url text;