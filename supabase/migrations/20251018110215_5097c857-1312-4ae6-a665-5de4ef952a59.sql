-- Create comprehensive audit logging triggers for complaints system

-- Function to audit complaint changes
CREATE OR REPLACE FUNCTION audit_complaint_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email text;
  v_action_desc text;
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
    COALESCE(NEW.id, OLD.id),
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

-- Function to audit acknowledgement actions
CREATE OR REPLACE FUNCTION audit_acknowledgement_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email text;
  v_action_desc text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action_desc := 'Acknowledgement letter created';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_desc := 'Acknowledgement letter updated';
  END IF;
  
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
    NEW.complaint_id,
    TG_OP,
    v_action_desc,
    auth.uid(),
    v_user_email,
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('sent_at', OLD.sent_at) ELSE NULL END,
    jsonb_build_object('sent_at', NEW.sent_at),
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Function to audit outcome actions
CREATE OR REPLACE FUNCTION audit_outcome_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  INSERT INTO public.complaint_audit_detailed (
    complaint_id,
    action_type,
    action_description,
    user_id,
    user_email,
    new_values,
    created_at
  ) VALUES (
    NEW.complaint_id,
    'OUTCOME_GENERATED',
    'Outcome letter generated: ' || NEW.outcome_type,
    auth.uid(),
    v_user_email,
    jsonb_build_object('outcome_type', NEW.outcome_type),
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Function to audit notes
CREATE OR REPLACE FUNCTION audit_complaint_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  INSERT INTO public.complaint_audit_detailed (
    complaint_id,
    action_type,
    action_description,
    user_id,
    user_email,
    new_values,
    created_at
  ) VALUES (
    NEW.complaint_id,
    'NOTE_ADDED',
    'Note added to complaint',
    auth.uid(),
    v_user_email,
    jsonb_build_object('is_internal', NEW.is_internal),
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Function to audit documents
CREATE OR REPLACE FUNCTION audit_complaint_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  INSERT INTO public.complaint_audit_detailed (
    complaint_id,
    action_type,
    action_description,
    user_id,
    user_email,
    new_values,
    created_at
  ) VALUES (
    NEW.complaint_id,
    'DOCUMENT_UPLOADED',
    'Document uploaded: ' || NEW.file_name,
    auth.uid(),
    v_user_email,
    jsonb_build_object('file_name', NEW.file_name, 'file_type', NEW.file_type),
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS audit_complaints_changes ON public.complaints;
DROP TRIGGER IF EXISTS audit_acknowledgement_changes ON public.complaint_acknowledgements;
DROP TRIGGER IF EXISTS audit_outcome_insert ON public.complaint_outcomes;
DROP TRIGGER IF EXISTS audit_notes_insert ON public.complaint_notes;
DROP TRIGGER IF EXISTS audit_documents_insert ON public.complaint_documents;

-- Create triggers for complaints table
CREATE TRIGGER audit_complaints_changes
AFTER INSERT OR UPDATE OR DELETE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION audit_complaint_changes();

-- Create trigger for acknowledgements
CREATE TRIGGER audit_acknowledgement_changes
AFTER INSERT OR UPDATE ON public.complaint_acknowledgements
FOR EACH ROW
EXECUTE FUNCTION audit_acknowledgement_actions();

-- Create trigger for outcomes
CREATE TRIGGER audit_outcome_insert
AFTER INSERT ON public.complaint_outcomes
FOR EACH ROW
EXECUTE FUNCTION audit_outcome_actions();

-- Create trigger for notes
CREATE TRIGGER audit_notes_insert
AFTER INSERT ON public.complaint_notes
FOR EACH ROW
EXECUTE FUNCTION audit_complaint_notes();

-- Create trigger for documents
CREATE TRIGGER audit_documents_insert
AFTER INSERT ON public.complaint_documents
FOR EACH ROW
EXECUTE FUNCTION audit_complaint_documents();