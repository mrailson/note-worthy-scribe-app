-- Ensure the submit_external_response function has proper permissions
-- This allows anyone to execute it (it uses SECURITY DEFINER to bypass RLS)
GRANT EXECUTE ON FUNCTION public.submit_external_response(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_external_response(uuid, text) TO authenticated;

-- Ensure the get_complaint_for_external_access function has proper permissions
GRANT EXECUTE ON FUNCTION public.get_complaint_for_external_access(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_complaint_for_external_access(uuid) TO authenticated;

-- Recreate the submit_external_response function with better error handling
CREATE OR REPLACE FUNCTION public.submit_external_response(access_token_param uuid, response_text_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows_updated integer;
BEGIN
  -- Log the attempt for debugging
  RAISE NOTICE 'Attempting to submit response for token: %', access_token_param;
  
  -- Update the response
  UPDATE public.complaint_involved_parties
  SET 
    response_text = response_text_param,
    response_submitted_at = now(),
    access_token_last_used_at = now()
  WHERE access_token = access_token_param
    AND (access_token_expires_at IS NULL OR access_token_expires_at > now());
  
  -- Get the number of rows updated
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  RAISE NOTICE 'Rows updated: %', v_rows_updated;
  
  -- Return true if at least one row was updated
  RETURN v_rows_updated > 0;
END;
$function$;
