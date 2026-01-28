-- Create RPC function to get policy usage report for admin dashboard
CREATE OR REPLACE FUNCTION public.get_policy_usage_report()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  clinical_count bigint,
  hr_count bigint,
  health_safety_count bigint,
  info_governance_count bigint,
  business_continuity_count bigint,
  patient_services_count bigint,
  total_policies bigint,
  last_24h bigint,
  last_7d bigint,
  last_30d bigint,
  last_created timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pc.user_id,
    COALESCE(p.email, 'Unknown')::text as email,
    p.full_name::text,
    COUNT(*) FILTER (WHERE prl.category = 'Clinical') as clinical_count,
    COUNT(*) FILTER (WHERE prl.category = 'HR') as hr_count,
    COUNT(*) FILTER (WHERE prl.category = 'Health & Safety') as health_safety_count,
    COUNT(*) FILTER (WHERE prl.category = 'Information Governance') as info_governance_count,
    COUNT(*) FILTER (WHERE prl.category = 'Business Continuity') as business_continuity_count,
    COUNT(*) FILTER (WHERE prl.category = 'Patient Services') as patient_services_count,
    COUNT(*) as total_policies,
    COUNT(*) FILTER (WHERE pc.created_at >= CURRENT_DATE) as last_24h,
    COUNT(*) FILTER (WHERE pc.created_at >= CURRENT_DATE - INTERVAL '7 days') as last_7d,
    COUNT(*) FILTER (WHERE pc.created_at >= CURRENT_DATE - INTERVAL '30 days') as last_30d,
    MAX(pc.created_at) as last_created
  FROM policy_completions pc
  LEFT JOIN profiles p ON p.user_id = pc.user_id
  LEFT JOIN policy_reference_library prl ON prl.id = pc.policy_reference_id
  WHERE pc.status = 'completed'
  GROUP BY pc.user_id, p.email, p.full_name
  ORDER BY total_policies DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_policy_usage_report() TO authenticated;