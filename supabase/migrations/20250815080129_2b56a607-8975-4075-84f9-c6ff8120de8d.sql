-- Fix the security issue with the function by adding SECURITY DEFINER and proper search_path
DROP FUNCTION IF EXISTS update_gp_practices_updated_at();

CREATE OR REPLACE FUNCTION update_gp_practices_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;