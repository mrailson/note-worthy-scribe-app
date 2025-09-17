-- Fix Extension Location Security Issues
-- Move PostgreSQL extensions from public schema to dedicated extensions schema

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_trgm extension to extensions schema
-- First, we need to update the extension location
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Move unaccent extension to extensions schema  
ALTER EXTENSION unaccent SET SCHEMA extensions;

-- Move any other extensions that might be in public schema
-- Check for fuzzystrmatch or other text processing extensions
DO $$
BEGIN
    -- Move fuzzystrmatch if it exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'fuzzystrmatch') THEN
        ALTER EXTENSION fuzzystrmatch SET SCHEMA extensions;
    END IF;
    
    -- Move pgcrypto if it exists in public
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        ALTER EXTENSION pgcrypto SET SCHEMA extensions;
    END IF;
    
    -- Move uuid-ossp if it exists in public
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
    END IF;
END $$;

-- Update search_path for functions that use these extensions
-- This ensures they can still find the extension functions

-- Update safe_similarity function to use extensions schema
CREATE OR REPLACE FUNCTION public.safe_similarity(text1 text, text2 text)
 RETURNS real
 LANGUAGE sql
 IMMUTABLE
 SET search_path = 'extensions', 'public', 'pg_temp'
AS $function$
  SELECT extensions.similarity(text1, text2);
$function$;

-- Update safe_unaccent function to use extensions schema
CREATE OR REPLACE FUNCTION public.safe_unaccent(input_text text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path = 'extensions', 'public', 'pg_temp'
AS $function$
  SELECT extensions.unaccent(input_text);
$function$;