-- Create name normaliser function for incoming query normalization
CREATE OR REPLACE FUNCTION public.icn_norm(text) 
RETURNS text
LANGUAGE sql 
IMMUTABLE AS $$
  SELECT lower(regexp_replace(unaccent($1),'\s+',' ','g'));
$$;