-- Continue with additional audit logging functions

-- Create trigger function for compliance check auditing
CREATE OR REPLACE FUNCTION public.audit_compliance_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Log compliance status changes
    IF OLD.is_compliant IS DISTINCT FROM NEW.is_compliant THEN
      PERFORM public.log_complaint_activity(
        NEW.complaint_id,
        'compliance_update',
        NEW.compliance_item || ' changed from ' || 
        CASE WHEN OLD.is_compliant THEN 'compliant' ELSE 'non-compliant' END ||
        ' to ' ||
        CASE WHEN NEW.is_compliant THEN 'compliant' ELSE 'non-compliant' END,
        jsonb_build_object('compliance_item', NEW.compliance_item, 'old_status', OLD.is_compliant),
        jsonb_build_object('compliance_item', NEW.compliance_item, 'new_status', NEW.is_compliant, 'notes', NEW.notes)
      );
    END IF;
    
    -- Log evidence changes
    IF OLD.evidence IS DISTINCT FROM NEW.evidence THEN
      PERFORM public.log_complaint_activity(
        NEW.complaint_id,
        'compliance_evidence_update',
        'Evidence updated for: ' || NEW.compliance_item,
        jsonb_build_object('old_evidence', OLD.evidence),
        jsonb_build_object('new_evidence', NEW.evidence)
      );
    END IF;
    
    -- Log notes changes
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      PERFORM public.log_complaint_activity(
        NEW.complaint_id,
        'compliance_notes_update',
        'Notes updated for: ' || NEW.compliance_item,
        jsonb_build_object('old_notes', OLD.notes),
        jsonb_build_object('new_notes', NEW.notes)
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Create trigger for compliance check auditing
CREATE TRIGGER audit_compliance_changes
    AFTER UPDATE ON public.complaint_compliance_checks
    FOR EACH ROW EXECUTE FUNCTION public.audit_compliance_changes();

-- Create trigger function for document auditing
CREATE OR REPLACE FUNCTION public.audit_document_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_complaint_document_action(
      NEW.complaint_id,
      'upload',
      NEW.file_name,
      NEW.id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_complaint_document_action(
      OLD.complaint_id,
      'delete',
      OLD.file_name,
      OLD.id
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Create triggers for document auditing
CREATE TRIGGER audit_document_changes
    AFTER INSERT OR DELETE ON public.complaint_documents
    FOR EACH ROW EXECUTE FUNCTION public.audit_document_changes();

CREATE TRIGGER audit_investigation_evidence_changes
    AFTER INSERT OR DELETE ON public.complaint_investigation_evidence
    FOR EACH ROW EXECUTE FUNCTION public.audit_document_changes();

-- Create trigger function for acknowledgement auditing
CREATE OR REPLACE FUNCTION public.audit_acknowledgement_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_complaint_activity(
      NEW.complaint_id,
      'acknowledgement_sent',
      'Acknowledgement letter sent',
      NULL,
      jsonb_build_object(
        'sent_at', NEW.sent_at,
        'sent_by', NEW.sent_by
      )
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Create trigger for acknowledgement auditing
CREATE TRIGGER audit_acknowledgement_changes
    AFTER INSERT ON public.complaint_acknowledgements
    FOR EACH ROW EXECUTE FUNCTION public.audit_acknowledgement_changes();

-- Create trigger function for outcome auditing
CREATE OR REPLACE FUNCTION public.audit_outcome_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_complaint_activity(
      NEW.complaint_id,
      'outcome_created',
      'Complaint outcome created: ' || NEW.outcome_type,
      NULL,
      jsonb_build_object(
        'outcome_type', NEW.outcome_type,
        'decided_at', NEW.decided_at,
        'decided_by', NEW.decided_by
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.outcome_type IS DISTINCT FROM NEW.outcome_type THEN
      PERFORM public.log_complaint_activity(
        NEW.complaint_id,
        'outcome_updated',
        'Outcome type changed from ' || OLD.outcome_type || ' to ' || NEW.outcome_type,
        jsonb_build_object('old_outcome_type', OLD.outcome_type),
        jsonb_build_object('new_outcome_type', NEW.outcome_type)
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Create trigger for outcome auditing
CREATE TRIGGER audit_outcome_changes
    AFTER INSERT OR UPDATE ON public.complaint_outcomes
    FOR EACH ROW EXECUTE FUNCTION public.audit_outcome_changes();

-- Create trigger function for notes auditing
CREATE OR REPLACE FUNCTION public.audit_notes_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_complaint_activity(
      NEW.complaint_id,
      'note_added',
      'Note added: ' || CASE WHEN NEW.is_internal THEN 'Internal note' ELSE 'External note' END,
      NULL,
      jsonb_build_object(
        'is_internal', NEW.is_internal,
        'note_preview', LEFT(NEW.note, 100) || CASE WHEN LENGTH(NEW.note) > 100 THEN '...' ELSE '' END,
        'created_by', NEW.created_by
      )
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Create trigger for notes auditing
CREATE TRIGGER audit_notes_changes
    AFTER INSERT ON public.complaint_notes
    FOR EACH ROW EXECUTE FUNCTION public.audit_notes_changes();

-- Create trigger function for involved parties auditing
CREATE OR REPLACE FUNCTION public.audit_involved_parties_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_complaint_activity(
      NEW.complaint_id,
      'involved_party_added',
      'Staff member added to complaint: ' || NEW.staff_name || ' (' || COALESCE(NEW.staff_role, 'Role not specified') || ')',
      NULL,
      jsonb_build_object(
        'staff_name', NEW.staff_name,
        'staff_email', NEW.staff_email,
        'staff_role', NEW.staff_role
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.response_submitted_at IS NULL AND NEW.response_submitted_at IS NOT NULL THEN
      PERFORM public.log_complaint_activity(
        NEW.complaint_id,
        'staff_response_submitted',
        'Response submitted by: ' || NEW.staff_name,
        NULL,
        jsonb_build_object(
          'staff_name', NEW.staff_name,
          'response_submitted_at', NEW.response_submitted_at
        )
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Create trigger for involved parties auditing
CREATE TRIGGER audit_involved_parties_changes
    AFTER INSERT OR UPDATE ON public.complaint_involved_parties
    FOR EACH ROW EXECUTE FUNCTION public.audit_involved_parties_changes();