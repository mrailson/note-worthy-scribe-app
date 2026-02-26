GRANT SELECT (
  id,
  complaint_id,
  staff_name,
  staff_email,
  staff_role,
  response_requested_at,
  response_submitted_at,
  response_text,
  access_token_expires_at,
  access_token_last_used_at,
  created_at
) ON public.complaint_involved_parties TO authenticated;