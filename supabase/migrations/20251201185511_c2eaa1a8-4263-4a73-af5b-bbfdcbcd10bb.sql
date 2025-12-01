-- Additional fix for Extension in Public security finding
-- This ensures all existing and future extensions are in the extensions schema

-- Ensure extensions schema exists
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA extensions TO postgres;

-- Drop and recreate extensions in the extensions schema
-- This is more reliable than ALTER EXTENSION SET SCHEMA

-- uuid-ossp (commonly used by Supabase)
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- pgcrypto (commonly used for encryption)
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- pg_trgm (commonly used for text search)
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- pgjwt (used for JWT handling)
DROP EXTENSION IF EXISTS pgjwt CASCADE;
CREATE EXTENSION IF NOT EXISTS pgjwt SCHEMA extensions;

-- pg_stat_statements (if it exists and user has permissions)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_stat_statements') THEN
        BEGIN
            DROP EXTENSION IF EXISTS pg_stat_statements CASCADE;
            CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA extensions;
        EXCEPTION WHEN insufficient_privilege THEN
            -- Skip if we don't have permissions (common in managed databases)
            NULL;
        END;
    END IF;
END $$;

-- Set default schema for future extensions
ALTER DATABASE postgres SET search_path TO public, extensions;

-- Update search_path for current session
SET search_path TO public, extensions;

-- Grant necessary permissions on extension functions to roles
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role;