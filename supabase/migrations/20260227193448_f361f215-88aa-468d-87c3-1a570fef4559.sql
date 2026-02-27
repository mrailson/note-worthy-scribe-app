ALTER TABLE public.nres_vault_audit_log
  ADD COLUMN IF NOT EXISTS browser_info text,
  ADD COLUMN IF NOT EXISTS ip_address text;