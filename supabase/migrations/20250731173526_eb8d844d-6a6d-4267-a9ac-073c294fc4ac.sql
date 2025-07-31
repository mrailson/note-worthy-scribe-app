-- Enhanced audit logging for complaints with comprehensive tracking

-- Drop and recreate the audit trigger function with more comprehensive logging
DROP TRIGGER IF EXISTS audit_complaint_changes ON public.complaints;
DROP FUNCTION IF EXISTS public.audit_complaint_changes();

-- Create enhanced audit function that logs all field changes
CREATE OR REPLACE FUNCTION public.audit_complaint_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  old_values jsonb := '{}'::jsonb;
  new_values jsonb := '{}'::jsonb;
  change_description text := '';
  field_changes text[] := '{}';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Track all field changes
    IF OLD.patient_name IS DISTINCT FROM NEW.patient_name THEN
      old_values := old_values || jsonb_build_object('patient_name', OLD.patient_name);
      new_values := new_values || jsonb_build_object('patient_name', NEW.patient_name);
      field_changes := array_append(field_changes, 'patient_name');
    END IF;
    
    IF OLD.patient_dob IS DISTINCT FROM NEW.patient_dob THEN
      old_values := old_values || jsonb_build_object('patient_dob', OLD.patient_dob);
      new_values := new_values || jsonb_build_object('patient_dob', NEW.patient_dob);
      field_changes := array_append(field_changes, 'patient_dob');
    END IF;
    
    IF OLD.patient_contact_phone IS DISTINCT FROM NEW.patient_contact_phone THEN
      old_values := old_values || jsonb_build_object('patient_contact_phone', OLD.patient_contact_phone);
      new_values := new_values || jsonb_build_object('patient_contact_phone', NEW.patient_contact_phone);
      field_changes := array_append(field_changes, 'patient_contact_phone');
    END IF;
    
    IF OLD.patient_contact_email IS DISTINCT FROM NEW.patient_contact_email THEN
      old_values := old_values || jsonb_build_object('patient_contact_email', OLD.patient_contact_email);
      new_values := new_values || jsonb_build_object('patient_contact_email', NEW.patient_contact_email);
      field_changes := array_append(field_changes, 'patient_contact_email');
    END IF;
    
    IF OLD.patient_address IS DISTINCT FROM NEW.patient_address THEN
      old_values := old_values || jsonb_build_object('patient_address', OLD.patient_address);
      new_values := new_values || jsonb_build_object('patient_address', NEW.patient_address);
      field_changes := array_append(field_changes, 'patient_address');
    END IF;
    
    IF OLD.incident_date IS DISTINCT FROM NEW.incident_date THEN
      old_values := old_values || jsonb_build_object('incident_date', OLD.incident_date);
      new_values := new_values || jsonb_build_object('incident_date', NEW.incident_date);
      field_changes := array_append(field_changes, 'incident_date');
    END IF;
    
    IF OLD.complaint_title IS DISTINCT FROM NEW.complaint_title THEN
      old_values := old_values || jsonb_build_object('complaint_title', OLD.complaint_title);
      new_values := new_values || jsonb_build_object('complaint_title', NEW.complaint_title);
      field_changes := array_append(field_changes, 'complaint_title');
    END IF;
    
    IF OLD.complaint_description IS DISTINCT FROM NEW.complaint_description THEN
      old_values := old_values || jsonb_build_object('complaint_description', 'Text content changed');
      new_values := new_values || jsonb_build_object('complaint_description', 'Text content updated');
      field_changes := array_append(field_changes, 'complaint_description');
    END IF;
    
    IF OLD.category IS DISTINCT FROM NEW.category THEN
      old_values := old_values || jsonb_build_object('category', OLD.category);
      new_values := new_values || jsonb_build_object('category', NEW.category);
      field_changes := array_append(field_changes, 'category');
    END IF;
    
    IF OLD.subcategory IS DISTINCT FROM NEW.subcategory THEN
      old_values := old_values || jsonb_build_object('subcategory', OLD.subcategory);
      new_values := new_values || jsonb_build_object('subcategory', NEW.subcategory);
      field_changes := array_append(field_changes, 'subcategory');
    END IF;
    
    IF OLD.location_service IS DISTINCT FROM NEW.location_service THEN
      old_values := old_values || jsonb_build_object('location_service', OLD.location_service);
      new_values := new_values || jsonb_build_object('location_service', NEW.location_service);
      field_changes := array_append(field_changes, 'location_service');
    END IF;
    
    IF OLD.staff_mentioned IS DISTINCT FROM NEW.staff_mentioned THEN
      old_values := old_values || jsonb_build_object('staff_mentioned', OLD.staff_mentioned);
      new_values := new_values || jsonb_build_object('staff_mentioned', NEW.staff_mentioned);
      field_changes := array_append(field_changes, 'staff_mentioned');
    END IF;
    
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      old_values := old_values || jsonb_build_object('status', OLD.status);
      new_values := new_values || jsonb_build_object('status', NEW.status);
      field_changes := array_append(field_changes, 'status');
    END IF;
    
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      old_values := old_values || jsonb_build_object('priority', OLD.priority);
      new_values := new_values || jsonb_build_object('priority', NEW.priority);
      field_changes := array_append(field_changes, 'priority');
    END IF;
    
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      old_values := old_values || jsonb_build_object('assigned_to', OLD.assigned_to);
      new_values := new_values || jsonb_build_object('assigned_to', NEW.assigned_to);
      field_changes := array_append(field_changes, 'assigned_to');
    END IF;
    
    IF OLD.consent_given IS DISTINCT FROM NEW.consent_given THEN
      old_values := old_values || jsonb_build_object('consent_given', OLD.consent_given);
      new_values := new_values || jsonb_build_object('consent_given', NEW.consent_given);
      field_changes := array_append(field_changes, 'consent_given');
    END IF;
    
    IF OLD.consent_details IS DISTINCT FROM NEW.consent_details THEN
      old_values := old_values || jsonb_build_object('consent_details', OLD.consent_details);
      new_values := new_values || jsonb_build_object('consent_details', NEW.consent_details);
      field_changes := array_append(field_changes, 'consent_details');
    END IF;
    
    IF OLD.complaint_on_behalf IS DISTINCT FROM NEW.complaint_on_behalf THEN
      old_values := old_values || jsonb_build_object('complaint_on_behalf', OLD.complaint_on_behalf);
      new_values := new_values || jsonb_build_object('complaint_on_behalf', NEW.complaint_on_behalf);
      field_changes := array_append(field_changes, 'complaint_on_behalf');
    END IF;
    
    IF OLD.practice_id IS DISTINCT FROM NEW.practice_id THEN
      old_values := old_values || jsonb_build_object('practice_id', OLD.practice_id);
      new_values := new_values || jsonb_build_object('practice_id', NEW.practice_id);
      field_changes := array_append(field_changes, 'practice_id');
    END IF;
    
    -- Only log if there were actual changes
    IF array_length(field_changes, 1) > 0 THEN
      change_description := 'Fields updated: ' || array_to_string(field_changes, ', ');
      
      PERFORM public.log_complaint_activity(
        NEW.id,
        'update',
        change_description,
        old_values,
        new_values
      );
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.log_complaint_activity(
      NEW.id,
      'create',
      'Complaint created with reference ' || NEW.reference_number,
      NULL,
      jsonb_build_object(
        'reference_number', NEW.reference_number,
        'status', NEW.status,
        'priority', NEW.priority,
        'category', NEW.category,
        'patient_name', NEW.patient_name,
        'incident_date', NEW.incident_date
      )
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER audit_complaint_changes
    AFTER INSERT OR UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.audit_complaint_changes();

-- Create function to log complaint views
CREATE OR REPLACE FUNCTION public.log_complaint_view(
  p_complaint_id uuid,
  p_view_context text DEFAULT 'general_view'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  log_id UUID;
  complaint_ref text;
BEGIN
  -- Get complaint reference for context
  SELECT reference_number INTO complaint_ref
  FROM public.complaints
  WHERE id = p_complaint_id;
  
  -- Log the view action
  SELECT public.log_complaint_activity(
    p_complaint_id,
    'view',
    'Complaint viewed (' || p_view_context || ') - Reference: ' || COALESCE(complaint_ref, 'Unknown'),
    NULL,
    jsonb_build_object(
      'view_context', p_view_context,
      'reference_number', complaint_ref,
      'viewed_at', now()
    )
  ) INTO log_id;
  
  RETURN log_id;
END;
$function$;

-- Create function to log document actions
CREATE OR REPLACE FUNCTION public.log_complaint_document_action(
  p_complaint_id uuid,
  p_action_type text,
  p_document_name text,
  p_document_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  SELECT public.log_complaint_activity(
    p_complaint_id,
    'document_' || p_action_type,
    'Document ' || p_action_type || ': ' || p_document_name,
    NULL,
    jsonb_build_object(
      'document_name', p_document_name,
      'document_id', p_document_id,
      'action_type', p_action_type
    )
  ) INTO log_id;
  
  RETURN log_id;
END;
$function$;

-- Create function to log compliance check changes
CREATE OR REPLACE FUNCTION public.log_compliance_check_change(
  p_complaint_id uuid,
  p_compliance_item text,
  p_old_status boolean,
  p_new_status boolean,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  log_id UUID;
  status_change_text text;
BEGIN
  status_change_text := p_compliance_item || ' changed from ' || 
    CASE WHEN p_old_status THEN 'compliant' ELSE 'non-compliant' END ||
    ' to ' ||
    CASE WHEN p_new_status THEN 'compliant' ELSE 'non-compliant' END;
  
  SELECT public.log_complaint_activity(
    p_complaint_id,
    'compliance_update',
    status_change_text,
    jsonb_build_object('compliance_item', p_compliance_item, 'old_status', p_old_status),
    jsonb_build_object('compliance_item', p_compliance_item, 'new_status', p_new_status, 'notes', p_notes)
  ) INTO log_id;
  
  RETURN log_id;
END;
$function$;

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
      PERFORM public.log_compliance_check_change(
        NEW.complaint_id,
        NEW.compliance_item,
        OLD.is_compliant,
        NEW.is_compliant,
        NEW.notes
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