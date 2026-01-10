-- Fix security issue: Make user_id NOT NULL to prevent orphaned records
-- First update any NULL user_ids (shouldn't exist, but safety check)
UPDATE public.lg_patients 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Make user_id NOT NULL
ALTER TABLE public.lg_patients 
ALTER COLUMN user_id SET NOT NULL;

-- Create audit log table for sensitive data access tracking
CREATE TABLE IF NOT EXISTS public.lg_patients_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'view', 'update', 'delete', 'export', 'download'
  action_details JSONB, -- Additional context (e.g., fields accessed)
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.lg_patients_audit_log ENABLE ROW LEVEL SECURITY;

-- Only system admins can view audit logs
CREATE POLICY "System admins can view audit logs"
ON public.lg_patients_audit_log
FOR SELECT
USING (is_system_admin(auth.uid()));

-- Users can insert their own audit entries (for client-side logging)
CREATE POLICY "Users can insert own audit entries"
ON public.lg_patients_audit_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for efficient audit queries
CREATE INDEX idx_lg_patients_audit_patient_id ON public.lg_patients_audit_log(patient_id);
CREATE INDEX idx_lg_patients_audit_user_id ON public.lg_patients_audit_log(user_id);
CREATE INDEX idx_lg_patients_audit_created_at ON public.lg_patients_audit_log(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE public.lg_patients_audit_log IS 'Audit trail for all access to sensitive patient data in lg_patients table';