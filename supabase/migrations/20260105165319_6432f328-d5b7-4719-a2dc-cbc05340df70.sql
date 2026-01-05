-- Fix linter WARN 1: set a fixed search_path on this trigger helper function
CREATE OR REPLACE FUNCTION public.update_nres_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
