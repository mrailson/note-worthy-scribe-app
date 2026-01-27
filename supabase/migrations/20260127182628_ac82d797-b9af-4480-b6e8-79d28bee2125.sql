-- Security hardening: ensure immutable helper has a fixed search_path
CREATE OR REPLACE FUNCTION public.try_parse_jsonb(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN p_text::jsonb;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;