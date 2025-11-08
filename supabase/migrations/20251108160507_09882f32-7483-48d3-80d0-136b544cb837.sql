-- Drop old versions of log_complaint_document_action to fix "not unique" error
DROP FUNCTION IF EXISTS public.log_complaint_document_action(uuid, text, text, uuid);

-- Recreate the function with all parameters
CREATE OR REPLACE FUNCTION public.log_complaint_document_action(
  p_complaint_id UUID,
  p_action_type TEXT,
  p_document_name TEXT,
  p_document_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Log the document action via log_complaint_activity
  PERFORM public.log_complaint_activity(
    p_complaint_id,
    p_action_type || '_document',
    'Document action: ' || p_action_type || ' - ' || p_document_name,
    NULL,
    jsonb_build_object(
      'document_id', p_document_id,
      'document_name', p_document_name,
      'action_type', p_action_type,
      'ip_address', p_ip_address,
      'user_agent', p_user_agent
    )
  );
END;
$$;