-- Make log_complaint_activity robust for anonymous/public links
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
BEGIN
  -- If auth.uid() is null (e.g., external link without session), attribute to complaint creator
  SELECT COALESCE(auth.uid(), c.created_by) INTO v_performed_by
  FROM public.complaints c
  WHERE c.id = p_complaint_id
  LIMIT 1;

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
END;
$function$;