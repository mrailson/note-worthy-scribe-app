-- Set default for performed_by to current auth user to avoid NULLs when triggers omit it
ALTER TABLE public.complaint_audit_log
  ALTER COLUMN performed_by SET DEFAULT auth.uid();

-- Optional: backfill recent NULLs if any exist (defensive), while avoiding policy violations by using SECURITY DEFINER function context
-- Note: This update will only run where RLS permits; if none, it will be a no-op
UPDATE public.complaint_audit_log
SET performed_by = auth.uid()
WHERE performed_by IS NULL;