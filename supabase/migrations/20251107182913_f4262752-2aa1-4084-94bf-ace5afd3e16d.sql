-- Update the get_complaint_compliance_summary function to use p_complaint_id
DROP FUNCTION IF EXISTS public.get_complaint_compliance_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_complaint_compliance_summary(p_complaint_id uuid)
RETURNS TABLE (
  complaint_id uuid,
  total_checks bigint,
  completed_checks bigint,
  compliance_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ccc.complaint_id,
    COUNT(*)::bigint as total_checks,
    COUNT(*) FILTER (WHERE ccc.is_compliant = true)::bigint as completed_checks,
    ROUND((COUNT(*) FILTER (WHERE ccc.is_compliant = true)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100, 1) as compliance_percentage
  FROM complaint_compliance_checks ccc
  WHERE ccc.complaint_id = p_complaint_id
  GROUP BY ccc.complaint_id;
END;
$$;