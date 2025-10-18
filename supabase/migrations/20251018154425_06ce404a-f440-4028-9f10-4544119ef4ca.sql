-- Fix deletion failure caused by FK on complaint_audit_detailed during complaints DELETE triggers
-- Update audit_complaint_changes() to avoid inserting a complaint_id on DELETE operations
CREATE OR REPLACE FUNCTION public.audit_complaint_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_email text;
  v_action_desc text;
  v_complaint_id uuid;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  -- Set action description based on operation
  IF TG_OP = 'INSERT' THEN
    v_action_desc := 'Complaint created';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_desc := 'Complaint updated';
  ELSIF TG_OP = 'DELETE' THEN
    v_action_desc := 'Complaint deleted';
  END IF;
  
  -- On DELETE, do not set complaint_id to avoid FK violations when the parent row is removed
  v_complaint_id := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE COALESCE(NEW.id, OLD.id) END;
  
  -- Insert audit record
  INSERT INTO public.complaint_audit_detailed (
    complaint_id,
    action_type,
    action_description,
    user_id,
    user_email,
    old_values,
    new_values,
    created_at
  ) VALUES (
    v_complaint_id,
    TG_OP,
    v_action_desc,
    auth.uid(),
    v_user_email,
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    now()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Optional: document why
COMMENT ON FUNCTION public.audit_complaint_changes() IS 'Logs complaint inserts/updates/deletes. For DELETE, complaint_id is NULL to avoid FK violations after the complaint row is removed.';
