-- Prevent anon queries (if any) from erroring due to missing EXECUTE privilege during RLS evaluation
GRANT EXECUTE ON FUNCTION public.is_nres_claims_admin() TO PUBLIC;
