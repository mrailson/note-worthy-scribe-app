-- Drop and recreate get_practice_users function with survey_manager_access
DROP FUNCTION IF EXISTS public.get_practice_users(uuid);

CREATE FUNCTION public.get_practice_users(p_practice_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role text,
  practice_role text,
  meeting_notes_access boolean,
  gp_scribe_access boolean,
  complaints_manager_access boolean,
  ai4gp_access boolean,
  enhanced_access boolean,
  cqc_compliance_access boolean,
  shared_drive_access boolean,
  mic_test_service_access boolean,
  api_testing_service_access boolean,
  translation_service_access boolean,
  fridge_monitoring_access boolean,
  cso_governance_access boolean,
  lg_capture_access boolean,
  bp_service_access boolean,
  survey_manager_access boolean,
  practice_assignments jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id as user_id,
    p.email::text,
    p.full_name::text,
    COALESCE(ur.role, 'practice_user')::text as role,
    COALESCE(ur.practice_role, '')::text as practice_role,
    COALESCE(ur.meeting_notes_access, false) as meeting_notes_access,
    COALESCE(ur.gp_scribe_access, false) as gp_scribe_access,
    COALESCE(ur.complaints_manager_access, false) as complaints_manager_access,
    COALESCE(ur.ai4gp_access, false) as ai4gp_access,
    COALESCE(ur.enhanced_access, false) as enhanced_access,
    COALESCE(ur.cqc_compliance_access, false) as cqc_compliance_access,
    COALESCE(ur.shared_drive_access, false) as shared_drive_access,
    COALESCE(ur.mic_test_service_access, false) as mic_test_service_access,
    COALESCE(ur.api_testing_service_access, false) as api_testing_service_access,
    COALESCE(ur.translation_service_access, false) as translation_service_access,
    COALESCE(ur.fridge_monitoring_access, false) as fridge_monitoring_access,
    COALESCE(ur.cso_governance_access, false) as cso_governance_access,
    COALESCE(ur.lg_capture_access, false) as lg_capture_access,
    COALESCE(ur.bp_service_access, false) as bp_service_access,
    COALESCE(ur.survey_manager_access, false) as survey_manager_access,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'practice_id', pa.practice_id,
          'practice_name', pd.practice_name
        ))
        FROM practice_assignments pa
        LEFT JOIN practice_details pd ON pd.id = pa.practice_id
        WHERE pa.user_id = p.id
      ),
      '[]'::jsonb
    ) as practice_assignments
  FROM profiles p
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  LEFT JOIN practice_assignments pa ON pa.user_id = p.id
  WHERE pa.practice_id = p_practice_id
  ORDER BY p.id, ur.created_at DESC;
END;
$$;