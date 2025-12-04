-- Add audit tracking columns to lg_patients table
ALTER TABLE public.lg_patients
ADD COLUMN IF NOT EXISTS last_audit_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_audit_by TEXT,
ADD COLUMN IF NOT EXISTS audit_report_url TEXT;