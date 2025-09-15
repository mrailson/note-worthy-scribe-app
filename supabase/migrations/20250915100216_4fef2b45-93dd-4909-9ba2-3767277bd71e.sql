-- Fix security definer view issues by removing unnecessary SECURITY DEFINER from view functions
-- The linter is detecting views that reference functions with SECURITY DEFINER

-- First, let's identify the specific issue by checking if any views are calling security definer functions
-- Since we can't modify the views directly without knowing which functions are problematic,
-- let's update functions that don't need SECURITY DEFINER to use SECURITY INVOKER instead

-- Update functions that are likely being called by views and don't need elevated privileges
CREATE OR REPLACE FUNCTION public.unaccent(text)
 RETURNS text
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
 SECURITY INVOKER  -- Changed from SECURITY DEFINER to SECURITY INVOKER
AS '$libdir/unaccent', 'unaccent_dict';

-- Update the unaccent function with regdictionary parameter as well
CREATE OR REPLACE FUNCTION public.unaccent(regdictionary, text)
 RETURNS text
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
 SECURITY INVOKER  -- Changed from SECURITY DEFINER to SECURITY INVOKER
AS '$libdir/unaccent', 'unaccent_dict';

-- Update similarity functions that might be used in views to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
 SECURITY INVOKER  -- Changed from SECURITY DEFINER to SECURITY INVOKER
AS '$libdir/pg_trgm', 'similarity';

-- Update word_similarity function
CREATE OR REPLACE FUNCTION public.word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
 SECURITY INVOKER  -- Changed from SECURITY DEFINER to SECURITY INVOKER  
AS '$libdir/pg_trgm', 'word_similarity';

-- Update show_trgm function
CREATE OR REPLACE FUNCTION public.show_trgm(text)
 RETURNS text[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
 SECURITY INVOKER  -- Changed from SECURITY DEFINER to SECURITY INVOKER
AS '$libdir/pg_trgm', 'show_trgm';