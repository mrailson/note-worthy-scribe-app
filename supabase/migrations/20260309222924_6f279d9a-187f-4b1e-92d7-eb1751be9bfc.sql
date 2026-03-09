
ALTER TABLE public.approval_signatories 
  ADD COLUMN IF NOT EXISTS signatory_title text,
  ADD COLUMN IF NOT EXISTS organisation_type text;

ALTER TABLE public.approval_contacts 
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS organisation_type text;
