-- Fix function parameter conflict by dropping and recreating
DROP FUNCTION IF EXISTS public.get_pcn_manager_practice_ids(uuid);

-- Recreate with proper search_path and consistent parameter naming
CREATE OR REPLACE FUNCTION public.get_pcn_manager_practice_ids(p_user_id uuid DEFAULT auth.uid())
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT ARRAY_AGG(DISTINCT practice_id)
  FROM public.user_roles
  WHERE user_id = p_user_id
    AND role = 'pcn_manager'
    AND practice_id IS NOT NULL;
$function$;

-- Continue with fixing the remaining functions that still need search_path

-- Identify and fix any PostgreSQL extension functions that are causing warnings
-- These are typically gin/gist operator functions from pg_trgm and unaccent extensions

-- Fix any remaining custom functions that might be missing search_path
-- Let's check for functions related to PostgreSQL extensions that might need explicit paths

-- Create schema for extensions if it doesn't exist (for later extension relocation)
CREATE SCHEMA IF NOT EXISTS extensions;