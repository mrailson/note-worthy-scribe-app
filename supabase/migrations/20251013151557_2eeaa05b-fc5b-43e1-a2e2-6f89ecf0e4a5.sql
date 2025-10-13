-- Create audit triggers for automatic logging

-- Trigger function for complaint updates
CREATE OR REPLACE FUNCTION public.audit_complaint_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_user_email text;
  v_changes jsonb := '{}'::jsonb;
  v_action_desc text := 'Updated complaint';
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  IF OLD.status != NEW.status THEN
    v_action_desc := 'Changed status from ' || OLD.status || ' to ' || NEW.status;
    v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    v_action_desc := CASE WHEN v_action_desc = 'Updated complaint' THEN 'Changed assignment'
      ELSE v_action_desc || ' and changed assignment' END;
    v_changes := v_changes || jsonb_build_object('assigned_to', jsonb_build_object('from', OLD.assigned_to, 'to', NEW.assigned_to));
  END IF;
  
  IF OLD.priority != NEW.priority THEN
    v_action_desc := CASE WHEN v_action_desc = 'Updated complaint' THEN 'Changed priority from ' || OLD.priority || ' to ' || NEW.priority
      ELSE v_action_desc || ' and changed priority' END;
    v_changes := v_changes || jsonb_build_object('priority', jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
  END IF;
  
  INSERT INTO public.complaint_audit_detailed (
    complaint_id, action_type, action_description, user_id, user_email, old_values, new_values, created_at
  ) VALUES (NEW.id, 'EDIT', v_action_desc, auth.uid(), v_user_email, row_to_json(OLD)::jsonb, v_changes, now());
  
  RETURN NEW;
END;
$$;

-- Trigger function for documents
CREATE OR REPLACE FUNCTION public.audit_document_actions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp' AS $$
DECLARE v_user_email text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.complaint_audit_detailed (complaint_id, action_type, action_description, user_id, user_email, new_values, created_at)
    VALUES (NEW.complaint_id, 'DOCUMENT_UPLOAD', 'Uploaded document: ' || NEW.file_name, auth.uid(), v_user_email,
      jsonb_build_object('file_name', NEW.file_name, 'file_type', NEW.file_type), now());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.complaint_audit_detailed (complaint_id, action_type, action_description, user_id, user_email, old_values, created_at)
    VALUES (OLD.complaint_id, 'DOCUMENT_DELETE', 'Deleted document: ' || OLD.file_name, auth.uid(), v_user_email,
      jsonb_build_object('file_name', OLD.file_name), now());
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

-- Trigger function for notes
CREATE OR REPLACE FUNCTION public.audit_note_actions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp' AS $$
DECLARE v_user_email text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.complaint_audit_detailed (complaint_id, action_type, action_description, user_id, user_email, new_values, created_at)
  VALUES (NEW.complaint_id, 'NOTE_CREATED', CASE WHEN NEW.is_internal THEN 'Added internal note' ELSE 'Added note' END, 
    auth.uid(), v_user_email, jsonb_build_object('note_preview', left(NEW.note, 100)), now());
  RETURN NEW;
END; $$;

-- Trigger function for acknowledgements
CREATE OR REPLACE FUNCTION public.audit_acknowledgement_actions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp' AS $$
DECLARE v_user_email text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.complaint_audit_detailed (complaint_id, action_type, action_description, user_id, user_email, new_values, created_at)
  VALUES (NEW.complaint_id, 'ACKNOWLEDGEMENT_GENERATED', 'Generated acknowledgement letter', auth.uid(), v_user_email,
    jsonb_build_object('sent_at', NEW.sent_at), now());
  RETURN NEW;
END; $$;

-- Trigger function for outcomes
CREATE OR REPLACE FUNCTION public.audit_outcome_actions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp' AS $$
DECLARE v_user_email text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.complaint_audit_detailed (complaint_id, action_type, action_description, user_id, user_email, new_values, created_at)
  VALUES (NEW.complaint_id, 'OUTCOME_GENERATED', 'Generated outcome letter: ' || NEW.outcome_type, auth.uid(), v_user_email,
    jsonb_build_object('outcome_type', NEW.outcome_type), now());
  RETURN NEW;
END; $$;

-- Trigger function for responses
CREATE OR REPLACE FUNCTION public.audit_response_actions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp' AS $$
DECLARE v_user_email text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.complaint_audit_detailed (complaint_id, action_type, action_description, user_id, user_email, new_values, created_at)
  VALUES (NEW.complaint_id, 'RESPONSE_SENT', 'Sent response: ' || NEW.response_type, auth.uid(), v_user_email,
    jsonb_build_object('response_type', NEW.response_type, 'subject', NEW.subject), now());
  RETURN NEW;
END; $$;

-- Create all triggers
DROP TRIGGER IF EXISTS audit_complaint_updates ON public.complaints;
CREATE TRIGGER audit_complaint_updates AFTER UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.audit_complaint_changes();

DROP TRIGGER IF EXISTS audit_document_insert ON public.complaint_documents;
CREATE TRIGGER audit_document_insert AFTER INSERT ON public.complaint_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_document_actions();

DROP TRIGGER IF EXISTS audit_document_delete ON public.complaint_documents;
CREATE TRIGGER audit_document_delete AFTER DELETE ON public.complaint_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_document_actions();

DROP TRIGGER IF EXISTS audit_note_insert ON public.complaint_notes;
CREATE TRIGGER audit_note_insert AFTER INSERT ON public.complaint_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_note_actions();

DROP TRIGGER IF EXISTS audit_acknowledgement_insert ON public.complaint_acknowledgements;
CREATE TRIGGER audit_acknowledgement_insert AFTER INSERT ON public.complaint_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION public.audit_acknowledgement_actions();

DROP TRIGGER IF EXISTS audit_outcome_insert ON public.complaint_outcomes;
CREATE TRIGGER audit_outcome_insert AFTER INSERT ON public.complaint_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.audit_outcome_actions();

DROP TRIGGER IF EXISTS audit_response_insert ON public.complaint_responses;
CREATE TRIGGER audit_response_insert AFTER INSERT ON public.complaint_responses
  FOR EACH ROW EXECUTE FUNCTION public.audit_response_actions();