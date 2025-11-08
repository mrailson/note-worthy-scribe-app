-- Fix log_complaint_activity to handle system/migration operations where auth.uid() is null
CREATE OR REPLACE FUNCTION public.log_complaint_activity(
  p_complaint_id uuid,
  p_action text,
  p_description text,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_performed_by uuid;
  v_system_admin_id uuid;
BEGIN
  -- Try to get current user, fallback to complaint creator, then system admin
  IF auth.uid() IS NOT NULL THEN
    v_performed_by := auth.uid();
  ELSE
    -- Try to get complaint creator
    SELECT created_by INTO v_performed_by
    FROM public.complaints
    WHERE id = p_complaint_id
    LIMIT 1;
    
    -- If still null, use a system admin (for migration/cleanup operations)
    IF v_performed_by IS NULL THEN
      SELECT user_id INTO v_performed_by
      FROM public.user_roles
      WHERE role = 'system_admin'
      LIMIT 1;
    END IF;
  END IF;
  
  -- Only insert if we have a valid user
  IF v_performed_by IS NOT NULL THEN
    INSERT INTO public.complaint_audit_log (
      complaint_id,
      action,
      details,
      performed_by,
      performed_at
    ) VALUES (
      p_complaint_id,
      p_action,
      jsonb_build_object(
        'description', p_description,
        'old_values', p_old_values,
        'new_values', p_new_values
      ),
      v_performed_by,
      now()
    );
  END IF;
END;
$function$;