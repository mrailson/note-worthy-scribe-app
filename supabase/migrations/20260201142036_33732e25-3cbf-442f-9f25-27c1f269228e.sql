-- Grant SELECT on specific columns of complaint_involved_parties (excluding access_token)
GRANT SELECT (
  id,
  complaint_id,
  staff_name,
  staff_email,
  staff_role,
  response_text,
  response_submitted_at,
  response_requested_at,
  access_token_expires_at,
  access_token_last_used_at,
  created_at
) ON public.complaint_involved_parties TO authenticated;

-- Grant SELECT on the secure view
GRANT SELECT ON public.complaint_involved_parties_secure TO authenticated;