-- Drop existing function with old signature and create comprehensive audit logging

-- Drop and recreate log_complaint_view function
DROP FUNCTION IF EXISTS public.log_complaint_view(uuid, text);

CREATE OR REPLACE FUNCTION public.log_complaint_view(
  p_complaint_id uuid,
  p_view_context text DEFAULT 'complaint_details_page'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
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
    p_complaint_id,
    'VIEW',
    'Viewed complaint details',
    auth.uid(),
    v_user_email,
    jsonb_build_object('context', p_view_context, 'timestamp', now()),
    now()
  );
END;
$$;

-- Create helper function for generic audit logging
CREATE OR REPLACE FUNCTION public.log_complaint_action(
  p_complaint_id uuid,
  p_action_type text,
  p_action_description text,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
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
    old_values,
    new_values,
    created_at
  ) VALUES (
    p_complaint_id,
    p_action_type,
    p_action_description,
    auth.uid(),
    v_user_email,
    p_old_values,
    p_new_values,
    now()
  );
END;
$$;