-- Create storage bucket for inbound email attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('inbound-email-attachments', 'inbound-email-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read attachments
CREATE POLICY "Authenticated users can read inbound email attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'inbound-email-attachments' AND auth.role() = 'authenticated');

-- Allow service role (edge functions) to insert attachments
CREATE POLICY "Service role can insert inbound email attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'inbound-email-attachments');