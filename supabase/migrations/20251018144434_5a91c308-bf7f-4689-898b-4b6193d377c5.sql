-- Create a SECURITY DEFINER function to safely cascade delete a complaint and all related records, bypassing RLS where necessary
CREATE OR REPLACE FUNCTION public.delete_complaint_cascade(p_complaint_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
  result jsonb := jsonb_build_object();
BEGIN
  -- Authorisation: mirror existing complaint RLS access patterns
  IF NOT (
    is_system_admin(auth.uid())
    OR has_role(auth.uid(), 'practice_manager'::app_role)
    OR has_role(auth.uid(), 'complaints_manager'::app_role)
    OR p_complaint_id IN (
      SELECT c.id
      FROM public.complaints c
      WHERE (c.practice_id = ANY (get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid())
    )
  ) THEN
    RAISE EXCEPTION 'Not authorised to delete this complaint';
  END IF;

  -- Delete dependent data in safe order
  DELETE FROM public.complaint_audit_detailed WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_audit_detailed', v_count);
  DELETE FROM public.complaint_audit_log WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_audit_log', v_count);
  DELETE FROM public.complaint_compliance_audit WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_compliance_audit', v_count);

  DELETE FROM public.complaint_outcome_questionnaires WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_outcome_questionnaires', v_count);
  DELETE FROM public.complaint_outcomes WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_outcomes', v_count);
  DELETE FROM public.complaint_acknowledgements WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_acknowledgements', v_count);
  DELETE FROM public.complaint_responses WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_responses', v_count);

  DELETE FROM public.complaint_investigation_transcripts WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_investigation_transcripts', v_count);
  DELETE FROM public.complaint_investigation_evidence WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_investigation_evidence', v_count);
  DELETE FROM public.complaint_investigation_findings WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_investigation_findings', v_count);
  DELETE FROM public.complaint_investigation_decisions WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_investigation_decisions', v_count);

  DELETE FROM public.complaint_involved_parties WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_involved_parties', v_count);
  DELETE FROM public.complaint_documents WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_documents', v_count);
  DELETE FROM public.complaint_notes WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_notes', v_count);
  DELETE FROM public.complaint_compliance_checks WHERE complaint_id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaint_compliance_checks', v_count);

  -- Finally delete the complaint record itself
  DELETE FROM public.complaints WHERE id = p_complaint_id; GET DIAGNOSTICS v_count = ROW_COUNT; result := result || jsonb_build_object('complaints', v_count);

  RETURN jsonb_build_object('success', true, 'details', result);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;