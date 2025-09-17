-- Final batch of function fixes
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
      
      -- Use actual function name in this schema
      INSERT INTO public.complaint_audit_log (
        complaint_id,
        action,
        details,
        performed_by
      ) VALUES (
        NEW.id,
        'update',
        jsonb_build_object(
          'description', change_description,
          'old_values', old_values,
          'new_values', new_values
        ),
        auth.uid()
      );
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.complaint_audit_log (
      complaint_id,
      action,
      details,
      performed_by
    ) VALUES (
      NEW.id,
      'create',
      jsonb_build_object(
        'description', 'Complaint created with reference ' || NEW.reference_number,
        'reference_number', NEW.reference_number,
        'status', NEW.status,
        'priority', NEW.priority,
        'category', NEW.category,
        'patient_name', NEW.patient_name,
        'incident_date', NEW.incident_date
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_staff_hours_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  assignment_week INTEGER;
  assignment_year INTEGER;
  assignment_month INTEGER;
  calculated_hours DECIMAL(4,2);
BEGIN
  -- Calculate which record to update
  IF TG_OP = 'DELETE' THEN
    assignment_week := EXTRACT(WEEK FROM OLD.assignment_date);
    assignment_year := EXTRACT(YEAR FROM OLD.assignment_date);
    assignment_month := EXTRACT(MONTH FROM OLD.assignment_date);
    
    -- Remove hours from summary
    INSERT INTO public.staff_hours_summary 
      (staff_member_id, year, month, week_number, total_hours, total_shifts)
    VALUES 
      (OLD.staff_member_id, assignment_year, assignment_month, assignment_week, 
       -(COALESCE(OLD.hours_worked, EXTRACT(EPOCH FROM (OLD.end_time - OLD.start_time))/3600)), -1)
    ON CONFLICT (staff_member_id, year, month, week_number)
    DO UPDATE SET
      total_hours = staff_hours_summary.total_hours - EXCLUDED.total_hours,
      total_shifts = staff_hours_summary.total_shifts - EXCLUDED.total_shifts,
      updated_at = now();
      
    RETURN OLD;
  ELSE
    assignment_week := EXTRACT(WEEK FROM NEW.assignment_date);
    assignment_year := EXTRACT(YEAR FROM NEW.assignment_date);
    assignment_month := EXTRACT(MONTH FROM NEW.assignment_date);
    
    -- Calculate hours (use hours_worked if available, otherwise calculate from times)
    calculated_hours := COALESCE(NEW.hours_worked, EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))/3600);
    
    -- Update summary
    INSERT INTO public.staff_hours_summary 
      (staff_member_id, year, month, week_number, total_hours, total_shifts)
    VALUES 
      (NEW.staff_member_id, assignment_year, assignment_month, assignment_week, calculated_hours, 1)
    ON CONFLICT (staff_member_id, year, month, week_number)
    DO UPDATE SET
      total_hours = staff_hours_summary.total_hours + EXCLUDED.total_hours,
      total_shifts = staff_hours_summary.total_shifts + EXCLUDED.total_shifts,
      updated_at = now();
      
    RETURN NEW;
  END IF;
END;
$function$;

-- Add the simplified log_security_event function for backward compatibility
CREATE OR REPLACE FUNCTION public.log_security_event(p_event_type text, p_user_id uuid, p_details jsonb DEFAULT NULL::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  -- Log security event in audit log
  SELECT public.log_system_activity(
    'security_events',
    p_event_type,
    p_user_id,
    NULL,
    p_details
  ) INTO log_id;
  
  RETURN log_id;
END;
$function$;

-- Fix any remaining update trigger functions
CREATE OR REPLACE FUNCTION public.update_complaint_status_on_acknowledgement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Update complaint status to under_review when acknowledgement is created
  UPDATE public.complaints 
  SET 
    status = 'under_review',
    acknowledged_at = COALESCE(acknowledged_at, NEW.created_at)
  WHERE id = NEW.complaint_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_complaint_status_on_outcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Update complaint status to closed when outcome is created
  UPDATE public.complaints 
  SET 
    status = 'closed',
    closed_at = COALESCE(closed_at, NEW.created_at)
  WHERE id = NEW.complaint_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number = public.generate_complaint_reference();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_incident_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.incident_reference IS NULL OR NEW.incident_reference = '' THEN
    NEW.incident_reference = generate_incident_reference();
  END IF;
  RETURN NEW;
END;
$function$;