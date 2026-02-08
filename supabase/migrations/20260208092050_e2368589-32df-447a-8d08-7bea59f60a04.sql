-- Add attachments JSONB column to store attachment metadata (file name, path, size, content_type)
ALTER TABLE public.inbound_emails
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;