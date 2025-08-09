-- Phase 1: Critical security fixes

-- 1) Add expiring external access tokens for involved staff responses
ALTER TABLE public.complaint_involved_parties
  ADD COLUMN IF NOT EXISTS access_token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS access_token_last_used_at timestamptz NULL;

-- Ensure fast lookup of tokens
CREATE INDEX IF NOT EXISTS idx_cip_access_token ON public.complaint_involved_parties (access_token);

-- 2) Enforce expiry in external access functions
CREATE OR REPLACE FUNCTION public.get_complaint_for_external_access(access_token_param uuid)
RETURNS TABLE(
  complaint_id uuid,
  reference_number text,
  complaint_title text,
  complaint_description text,
  category complaint_category,
  incident_date date,
  location_service text,
  staff_name text,
  staff_email text,
  staff_role text,
  response_text text,
  response_submitted boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT 
    c.id as complaint_id,
    c.reference_number,
    c.complaint_title,
    c.complaint_description,
    c.category,
    c.incident_date,
    c.location_service,
    cip.staff_name,
    cip.staff_email,
    cip.staff_role,
    cip.response_text,
    (cip.response_submitted_at IS NOT NULL) as response_submitted
  FROM public.complaints c
  JOIN public.complaint_involved_parties cip ON c.id = cip.complaint_id
  WHERE cip.access_token = access_token_param
    AND (cip.access_token_expires_at IS NULL OR cip.access_token_expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.submit_external_response(access_token_param uuid, response_text_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.complaint_involved_parties
  SET 
    response_text = response_text_param,
    response_submitted_at = now(),
    access_token_last_used_at = now()
  WHERE access_token = access_token_param
    AND (access_token_expires_at IS NULL OR access_token_expires_at > now());
  
  RETURN FOUND;
END;
$$;

-- 3) Add enforcement and auditing triggers for role changes (defense-in-depth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'prevent_self_privilege_escalation_trg'
  ) THEN
    CREATE TRIGGER prevent_self_privilege_escalation_trg
    BEFORE INSERT OR UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_self_privilege_escalation();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_role_changes_trg'
  ) THEN
    CREATE TRIGGER audit_role_changes_trg
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_role_changes();
  END IF;
END $$;