ALTER TABLE approval_signatories ADD COLUMN IF NOT EXISTS group_token uuid;
CREATE INDEX IF NOT EXISTS idx_sig_group_token ON approval_signatories(group_token) WHERE group_token IS NOT NULL;