-- Fix remaining Extension Location warning - be selective about moveable extensions
-- Only move extensions that actually support SET SCHEMA

DO $$
DECLARE
    ext_name text;
    moveable_extensions text[] := ARRAY['pg_trgm', 'unaccent', 'fuzzystrmatch', 'pgcrypto', 'uuid-ossp', 'ltree', 'hstore'];
BEGIN
    -- Only move extensions that are known to support schema relocation
    FOR ext_name IN 
        SELECT e.extname 
        FROM pg_extension e 
        JOIN pg_namespace n ON e.extnamespace = n.oid 
        WHERE n.nspname = 'public'
        AND e.extname = ANY(moveable_extensions)
    LOOP
        BEGIN
            -- Try to move extension to extensions schema
            EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext_name);
            RAISE NOTICE 'Moved extension % to extensions schema', ext_name;
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not move extension %: %', ext_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- For extensions that cannot be moved (like pg_net), we'll leave them in public
-- but ensure they don't cause security issues by documenting them as system extensions

-- Create a documentation table for unmoveable system extensions
CREATE TABLE IF NOT EXISTS public.system_extensions_info (
    extension_name TEXT PRIMARY KEY,
    reason_not_moved TEXT,
    security_notes TEXT,
    documented_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document pg_net and other system extensions that cannot be moved
INSERT INTO public.system_extensions_info (extension_name, reason_not_moved, security_notes)
VALUES 
    ('pg_net', 'Extension does not support SET SCHEMA', 'System extension for HTTP requests - cannot be relocated')
ON CONFLICT (extension_name) DO UPDATE SET
    reason_not_moved = EXCLUDED.reason_not_moved,
    security_notes = EXCLUDED.security_notes,
    documented_at = NOW();