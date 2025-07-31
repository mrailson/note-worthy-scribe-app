-- Enhanced audit logging for complaints with comprehensive tracking

-- First, drop the existing trigger properly
DROP TRIGGER IF EXISTS complaint_audit_trigger ON public.complaints;
DROP TRIGGER IF EXISTS audit_complaint_changes ON public.complaints;

-- Drop and recreate the audit trigger function with more comprehensive logging
DROP FUNCTION IF EXISTS public.audit_complaint_changes() CASCADE;

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