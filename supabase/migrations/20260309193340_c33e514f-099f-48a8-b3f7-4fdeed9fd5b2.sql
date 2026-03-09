
ALTER TABLE public.approval_documents 
  ADD COLUMN IF NOT EXISTS signature_placement jsonb DEFAULT '{"method": "append"}'::jsonb,
  ADD COLUMN IF NOT EXISTS signed_file_url text;
