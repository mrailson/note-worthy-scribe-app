-- Create enhanced audit logging system for complaints

-- Drop existing tables if they exist (for clean recreation)
DROP TABLE IF EXISTS public.complaint_audit_detailed CASCADE;
DROP TABLE IF EXISTS public.complaint_compliance_audit CASCADE;

-- Create detailed audit log table for all complaint activities
CREATE TABLE public.complaint_audit_detailed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  action_type TEXT NOT NULL, -- 'view', 'edit', 'status_change', 'compliance_update', 'create', 'delete'
  action_description TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create specific compliance audit log table
CREATE TABLE public.complaint_compliance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  compliance_check_id UUID REFERENCES public.complaint_compliance_checks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  compliance_item TEXT NOT NULL,
  previous_status BOOLEAN NOT NULL,
  new_status BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit tables
ALTER TABLE public.complaint_audit_detailed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_compliance_audit ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_complaint_audit_detailed_complaint_id ON public.complaint_audit_detailed(complaint_id);
CREATE INDEX idx_complaint_audit_detailed_created_at ON public.complaint_audit_detailed(created_at DESC);
CREATE INDEX idx_complaint_audit_detailed_user_id ON public.complaint_audit_detailed(user_id);
CREATE INDEX idx_complaint_audit_detailed_action_type ON public.complaint_audit_detailed(action_type);

CREATE INDEX idx_complaint_compliance_audit_complaint_id ON public.complaint_compliance_audit(complaint_id);
CREATE INDEX idx_complaint_compliance_audit_created_at ON public.complaint_compliance_audit(created_at DESC);
CREATE INDEX idx_complaint_compliance_audit_user_id ON public.complaint_compliance_audit(user_id);

-- Create function to log complaint activities
CREATE OR REPLACE FUNCTION public.log_complaint_activity(
  p_complaint_id UUID,
  p_action_type TEXT,
  p_action_description TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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
$$;

-- Create function to log compliance changes
CREATE OR REPLACE FUNCTION public.log_compliance_change(
  p_complaint_id UUID,
  p_compliance_check_id UUID,
  p_compliance_item TEXT,
  p_previous_status BOOLEAN,
  p_new_status BOOLEAN,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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
$$;

-- Create trigger function for complaint status changes
CREATE OR REPLACE FUNCTION public.audit_complaint_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      PERFORM public.log_complaint_activity(
        NEW.id,
        'status_change',
        'Status changed from ' || OLD.status || ' to ' || NEW.status,
        jsonb_build_object('old_status', OLD.status),
        jsonb_build_object('new_status', NEW.status)
      );
    END IF;
    
    -- Log priority changes
    IF OLD.priority != NEW.priority THEN
      PERFORM public.log_complaint_activity(
        NEW.id,
        'edit',
        'Priority changed from ' || OLD.priority || ' to ' || NEW.priority,
        jsonb_build_object('old_priority', OLD.priority),
        jsonb_build_object('new_priority', NEW.priority)
      );
    END IF;
    
    -- Log assignment changes
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      PERFORM public.log_complaint_activity(
        NEW.id,
        'edit',
        'Assignment changed',
        jsonb_build_object('old_assigned_to', OLD.assigned_to),
        jsonb_build_object('new_assigned_to', NEW.assigned_to)
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
        'status', NEW.status,
        'priority', NEW.priority,
        'category', NEW.category,
        'patient_name', NEW.patient_name
      )
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create trigger for complaint changes
CREATE TRIGGER complaint_audit_trigger
  AFTER INSERT OR UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_complaint_changes();

-- Create RLS policies for audit tables
CREATE POLICY "Users can view audit logs for their practice complaints"
ON public.complaint_audit_detailed
FOR SELECT
TO authenticated
USING (
  is_system_admin() OR 
  complaint_id IN (
    SELECT c.id FROM complaints c
    WHERE (
      c.practice_id IN (
        SELECT ur.practice_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
      ) OR 
      c.created_by = auth.uid()
    )
  )
);

CREATE POLICY "Users can view compliance audit logs for their practice complaints"
ON public.complaint_compliance_audit
FOR SELECT
TO authenticated
USING (
  is_system_admin() OR 
  complaint_id IN (
    SELECT c.id FROM complaints c
    WHERE (
      c.practice_id IN (
        SELECT ur.practice_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
      ) OR 
      c.created_by = auth.uid()
    )
  )
);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON public.complaint_audit_detailed
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert compliance audit logs"
ON public.complaint_compliance_audit
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());