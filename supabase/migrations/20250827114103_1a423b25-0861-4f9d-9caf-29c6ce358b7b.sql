-- Fix remaining Security Definer Views and Function Search Path issues

-- Drop any remaining security definer views that use auth functions
DROP VIEW IF EXISTS public.user_profiles_with_roles;
DROP VIEW IF EXISTS public.practice_users_view;
DROP VIEW IF EXISTS public.meeting_access_view;
DROP VIEW IF EXISTS public.shared_meetings_view;
DROP VIEW IF EXISTS public.user_practice_access;
DROP VIEW IF EXISTS public.complaint_access_view;

-- Update all remaining SECURITY DEFINER functions to include proper search_path
CREATE OR REPLACE FUNCTION public.create_default_attendee_templates(p_practice_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Create a default "Regular Meeting" template
  INSERT INTO public.meeting_attendee_templates (
    practice_id, 
    template_name, 
    description, 
    is_default, 
    created_by
  ) VALUES (
    p_practice_id,
    'Regular Meeting',
    'Standard attendee list for regular practice meetings',
    true,
    p_user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_system_admin_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Prevent deletion of system_admin roles
  IF OLD.role = 'system_admin' THEN
    -- Log the attempt
    INSERT INTO public.system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      user_email,
      old_values,
      new_values
    ) VALUES (
      'user_roles',
      'BLOCKED_SYSTEM_ADMIN_DELETION',
      OLD.id,
      COALESCE(auth.uid(), OLD.user_id),
      COALESCE(auth.email(), 'system'),
      row_to_json(OLD),
      jsonb_build_object('reason', 'System admin roles cannot be deleted', 'blocked_at', now())
    );
    
    -- Raise an exception to prevent the deletion
    RAISE EXCEPTION 'Cannot delete system_admin role. System administrators are protected from deletion.';
  END IF;
  
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_user_module(p_user_id uuid, p_module app_module)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.user_modules
  SET enabled = false, updated_at = now()
  WHERE user_id = p_user_id AND module = p_module;
  
  -- Log the module revocation
  PERFORM public.log_system_activity(
    'user_modules',
    'MODULE_REVOKED',
    p_user_id,
    jsonb_build_object('module', p_module),
    NULL
  );
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_expired_data()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  purged_count INTEGER := 0;
  total_purged INTEGER := 0;
  result_text TEXT := '';
BEGIN
  -- Log the purge operation start
  PERFORM public.log_system_activity('system_maintenance', 'DATA_PURGE_START');
  
  -- Purge expired meetings
  DELETE FROM public.meetings 
  WHERE data_retention_date < NOW();
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  total_purged := total_purged + purged_count;
  result_text := result_text || 'Meetings purged: ' || purged_count || E'\n';
  
  -- Purge expired communications
  DELETE FROM public.communications 
  WHERE data_retention_date < NOW();
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  total_purged := total_purged + purged_count;
  result_text := result_text || 'Communications purged: ' || purged_count || E'\n';
  
  -- Purge expired complaints (only if closed)
  DELETE FROM public.complaints 
  WHERE data_retention_date < NOW() 
  AND status IN ('resolved', 'closed', 'rejected');
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  total_purged := total_purged + purged_count;
  result_text := result_text || 'Complaints purged: ' || purged_count || E'\n';
  
  -- Purge old audit logs (keep system audit for 7 years)
  DELETE FROM public.system_audit_log 
  WHERE timestamp < NOW() - INTERVAL '7 years';
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  total_purged := total_purged + purged_count;
  result_text := result_text || 'Audit logs purged: ' || purged_count || E'\n';
  
  result_text := result_text || 'Total records purged: ' || total_purged;
  
  -- Log the purge operation completion
  PERFORM public.log_system_activity('system_maintenance', 'DATA_PURGE_COMPLETE', NULL, NULL, 
    jsonb_build_object('total_purged', total_purged, 'details', result_text));
  
  RETURN result_text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_complaint_activity(p_complaint_id uuid, p_action_type text, p_action_description text, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.complaint_audit_detailed (
    complaint_id,
    user_id,
    user_email,
    action_type,
    action_description,
    old_values,
    new_values
  ) VALUES (
    p_complaint_id,
    auth.uid(),
    auth.email(),
    p_action_type,
    p_action_description,
    p_old_values,
    p_new_values
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_compliance_change(p_complaint_id uuid, p_compliance_check_id uuid, p_compliance_item text, p_previous_status boolean, p_new_status boolean, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.complaint_compliance_audit (
    complaint_id,
    compliance_check_id,
    user_id,
    user_email,
    compliance_item,
    previous_status,
    new_status,
    notes
  ) VALUES (
    p_complaint_id,
    p_compliance_check_id,
    auth.uid(),
    auth.email(),
    p_compliance_item,
    p_previous_status,
    p_new_status,
    p_notes
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_large_files(min_size_bytes bigint DEFAULT 10485760)
 RETURNS TABLE(table_name text, file_name text, file_size bigint, file_size_pretty text, uploaded_at timestamp with time zone, uploaded_by_email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  
  -- Files from meeting_documents
  SELECT 
    'meeting_documents'::text,
    md.file_name,
    md.file_size::bigint,
    pg_size_pretty(md.file_size::bigint),
    md.uploaded_at,
    COALESCE(p.email, 'Unknown')::text
  FROM meeting_documents md
  LEFT JOIN auth.users au ON md.uploaded_by = au.id
  LEFT JOIN profiles p ON md.uploaded_by = p.user_id
  WHERE md.file_size >= min_size_bytes
  
  UNION ALL
  
  -- Files from meeting_audio_backups
  SELECT 
    'meeting_audio_backups'::text,
    'Audio backup file'::text,
    mab.file_size::bigint,
    pg_size_pretty(mab.file_size::bigint),
    mab.created_at,
    COALESCE(p.email, 'Unknown')::text
  FROM meeting_audio_backups mab
  LEFT JOIN auth.users au ON mab.user_id = au.id
  LEFT JOIN profiles p ON mab.user_id = p.user_id
  WHERE mab.file_size >= min_size_bytes
  
  UNION ALL
  
  -- Files from complaint_investigation_evidence
  SELECT 
    'complaint_investigation_evidence'::text,
    cie.file_name,
    cie.file_size::bigint,
    pg_size_pretty(cie.file_size::bigint),
    cie.uploaded_at,
    COALESCE(p.email, 'Unknown')::text
  FROM complaint_investigation_evidence cie
  LEFT JOIN auth.users au ON cie.uploaded_by = au.id
  LEFT JOIN profiles p ON cie.uploaded_by = p.user_id
  WHERE cie.file_size >= min_size_bytes
  
  UNION ALL
  
  -- Files from contractor_resumes
  SELECT 
    'contractor_resumes'::text,
    cr.file_name,
    cr.file_size::bigint,
    pg_size_pretty(cr.file_size::bigint),
    cr.uploaded_at,
    COALESCE(p.email, 'Unknown')::text
  FROM contractor_resumes cr
  LEFT JOIN auth.users au ON cr.uploaded_by = au.id
  LEFT JOIN profiles p ON cr.uploaded_by = p.user_id
  WHERE cr.file_size >= min_size_bytes
  
  UNION ALL
  
  -- Files from cqc_evidence
  SELECT 
    'cqc_evidence'::text,
    COALESCE(ce.file_name, 'CQC Evidence File')::text,
    ce.file_size::bigint,
    pg_size_pretty(ce.file_size::bigint),
    ce.created_at,
    COALESCE(p.email, 'Unknown')::text
  FROM cqc_evidence ce
  LEFT JOIN auth.users au ON ce.uploaded_by = au.id
  LEFT JOIN profiles p ON ce.uploaded_by = p.user_id
  WHERE ce.file_size >= min_size_bytes
  
  ORDER BY file_size DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_meeting_content_access(p_meeting_id uuid, p_content_type text, p_action text DEFAULT 'view'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Log access to meeting content for security monitoring
    INSERT INTO public.system_audit_log (
        table_name,
        operation,
        record_id,
        user_id,
        user_email,
        new_values
    ) VALUES (
        'meeting_content_access',
        'CONTENT_ACCESS',
        p_meeting_id,
        auth.uid(),
        auth.email(),
        jsonb_build_object(
            'content_type', p_content_type,
            'action', p_action,
            'access_time', now(),
            'meeting_id', p_meeting_id
        )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_meeting_access_and_log(p_meeting_id uuid, p_content_type text DEFAULT 'general'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    has_access BOOLEAN;
BEGIN
    -- Check if user has access to the meeting
    SELECT user_has_meeting_access(p_meeting_id, auth.uid()) INTO has_access;
    
    -- Log the access attempt
    IF has_access THEN
        PERFORM log_meeting_content_access(p_meeting_id, p_content_type, 'authorized_access');
    ELSE
        PERFORM log_meeting_content_access(p_meeting_id, p_content_type, 'unauthorized_attempt');
    END IF;
    
    RETURN has_access;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_shared_drive_permission(p_user_id uuid, p_target_id uuid, p_target_type file_type, p_action permission_action)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  user_permission permission_level;
  allowed_actions permission_action[];
BEGIN
  -- Check direct permission
  SELECT permission_level, actions INTO user_permission, allowed_actions
  FROM public.shared_drive_permissions
  WHERE target_id = p_target_id 
    AND target_type = p_target_type 
    AND user_id = p_user_id;
  
  -- If direct permission found, check if action is allowed
  IF user_permission IS NOT NULL THEN
    RETURN p_action = ANY(allowed_actions) OR user_permission = 'owner';
  END IF;
  
  -- If no direct permission and it's a file, check folder permission
  IF p_target_type = 'file' THEN
    SELECT permission_level, actions INTO user_permission, allowed_actions
    FROM public.shared_drive_permissions p
    JOIN public.shared_drive_files f ON f.folder_id = p.target_id
    WHERE f.id = p_target_id 
      AND p.target_type = 'folder'
      AND p.user_id = p_user_id;
      
    IF user_permission IS NOT NULL THEN
      RETURN p_action = ANY(allowed_actions) OR user_permission = 'owner';
    END IF;
  END IF;
  
  -- Check if user created the item (owner access)
  IF p_target_type = 'folder' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.shared_drive_folders 
      WHERE id = p_target_id AND created_by = p_user_id
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM public.shared_drive_files 
      WHERE id = p_target_id AND created_by = p_user_id
    );
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_complaint_view(p_complaint_id uuid, p_view_context text DEFAULT 'general_view'::text)
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

CREATE OR REPLACE FUNCTION public.log_complaint_document_action(p_complaint_id uuid, p_action_type text, p_document_name text, p_document_id uuid DEFAULT NULL::uuid)
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

CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  reference TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the next sequence number for this year
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.complaints
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  reference := 'CP' || year_part || LPAD(sequence_num::TEXT, 5, '0');
  
  RETURN reference;
END;
$function$;

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