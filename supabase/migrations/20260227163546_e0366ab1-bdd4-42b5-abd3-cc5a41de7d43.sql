
-- Create audit log table for NRES Document Vault
CREATE TABLE public.nres_vault_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  target_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nres_vault_audit_log ENABLE ROW LEVEL SECURITY;

-- Only vault admins can read audit logs
CREATE POLICY "Vault admins can read audit logs"
ON public.nres_vault_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.nres_vault_admins WHERE user_id = auth.uid()
  )
);

-- Any authenticated NRES user can insert audit log entries (their own actions)
CREATE POLICY "Users can insert own audit log entries"
ON public.nres_vault_audit_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Index for querying
CREATE INDEX idx_nres_vault_audit_log_created_at ON public.nres_vault_audit_log (created_at DESC);
CREATE INDEX idx_nres_vault_audit_log_action ON public.nres_vault_audit_log (action);
CREATE INDEX idx_nres_vault_audit_log_user_id ON public.nres_vault_audit_log (user_id);
