-- Fix the security issue by properly dropping and recreating the trigger and function
DROP TRIGGER IF EXISTS update_gp_practices_updated_at ON public.gp_practices;
DROP FUNCTION IF EXISTS update_gp_practices_updated_at();

CREATE OR REPLACE FUNCTION update_gp_practices_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_gp_practices_updated_at
  BEFORE UPDATE ON public.gp_practices
  FOR EACH ROW
  EXECUTE FUNCTION update_gp_practices_updated_at();