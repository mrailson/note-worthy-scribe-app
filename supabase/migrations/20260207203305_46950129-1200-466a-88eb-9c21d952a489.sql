-- Create inbound_emails table for logging all received emails
CREATE TABLE public.inbound_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id text,
  from_email text,
  from_name text,
  to_email text,
  subject text,
  text_body text,
  html_body text,
  has_attachments boolean DEFAULT false,
  attachment_count integer DEFAULT 0,
  classification text,
  record_id uuid,
  record_type text,
  processing_status text NOT NULL DEFAULT 'pending',
  processing_notes text,
  practice_id uuid REFERENCES public.practice_details(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view inbound emails (service role inserts via edge function)
CREATE POLICY "Authenticated users can view inbound emails"
  ON public.inbound_emails
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX idx_inbound_emails_processing_status ON public.inbound_emails (processing_status);
CREATE INDEX idx_inbound_emails_classification ON public.inbound_emails (classification);
CREATE INDEX idx_inbound_emails_created_at ON public.inbound_emails (created_at DESC);