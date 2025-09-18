-- Secure drug reference tables with RLS - handle views appropriately

-- For icn_formulary (this is a real table)
ALTER TABLE public.icn_formulary ENABLE ROW LEVEL SECURITY;

-- Update icn_formulary policy to require authentication only
DROP POLICY IF EXISTS "Authenticated users can view formulary data" ON public.icn_formulary;
CREATE POLICY "Authenticated users can view formulary data" 
ON public.icn_formulary 
FOR SELECT 
TO authenticated
USING (true);

-- Remove public access from formulary
REVOKE SELECT ON public.icn_formulary FROM anon;

-- For any other drug reference tables that might exist as real tables
-- Check if these exist as tables and secure them

DO $$ 
BEGIN
    -- Check and secure icn_pa_norm if it exists as a table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'icn_pa_norm' AND table_type = 'BASE TABLE') THEN
        EXECUTE 'ALTER TABLE public.icn_pa_norm ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "Authenticated users can view PA drug data" ON public.icn_pa_norm FOR SELECT TO authenticated USING (true)';
        EXECUTE 'REVOKE SELECT ON public.icn_pa_norm FROM anon';
    END IF;
    
    -- Check and secure icn_policy_unified if it exists as a table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'icn_policy_unified' AND table_type = 'BASE TABLE') THEN
        EXECUTE 'ALTER TABLE public.icn_policy_unified ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "Authenticated users can view unified policy data" ON public.icn_policy_unified FOR SELECT TO authenticated USING (true)';
        EXECUTE 'REVOKE SELECT ON public.icn_policy_unified FROM anon';
    END IF;
    
    -- Check and secure icn_policy_unified_fuzzy if it exists as a table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'icn_policy_unified_fuzzy' AND table_type = 'BASE TABLE') THEN
        EXECUTE 'ALTER TABLE public.icn_policy_unified_fuzzy ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "Authenticated users can view fuzzy policy data" ON public.icn_policy_unified_fuzzy FOR SELECT TO authenticated USING (true)';
        EXECUTE 'REVOKE SELECT ON public.icn_policy_unified_fuzzy FROM anon';
    END IF;
    
    -- Check and secure icn_tl_norm2 if it exists as a table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'icn_tl_norm2' AND table_type = 'BASE TABLE') THEN
        EXECUTE 'ALTER TABLE public.icn_tl_norm2 ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "Authenticated users can view drug reference data v2" ON public.icn_tl_norm2 FOR SELECT TO authenticated USING (true)';
        EXECUTE 'REVOKE SELECT ON public.icn_tl_norm2 FROM anon';
    END IF;
    
    -- Check and secure icn_pa_norm2 if it exists as a table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'icn_pa_norm2' AND table_type = 'BASE TABLE') THEN
        EXECUTE 'ALTER TABLE public.icn_pa_norm2 ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "Authenticated users can view PA drug data v2" ON public.icn_pa_norm2 FOR SELECT TO authenticated USING (true)';
        EXECUTE 'REVOKE SELECT ON public.icn_pa_norm2 FROM anon';
    END IF;
END $$;

-- For views like icn_tl_norm, we need to secure the underlying tables or restrict view access
-- Remove public access to any drug reference views
DO $$
BEGIN
    -- Revoke access from anon users to views
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'icn_tl_norm') THEN
        EXECUTE 'REVOKE SELECT ON public.icn_tl_norm FROM anon';
    END IF;
    
    -- Grant access only to authenticated users
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'icn_tl_norm') THEN
        EXECUTE 'GRANT SELECT ON public.icn_tl_norm TO authenticated';
    END IF;
END $$;