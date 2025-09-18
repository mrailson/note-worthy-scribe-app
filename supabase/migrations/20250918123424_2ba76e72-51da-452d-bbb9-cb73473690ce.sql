-- Fix NHS terms and CQC domains public access security issue
-- Restrict access to authenticated healthcare users only

-- Check and secure nhs_terms table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'nhs_terms' AND table_schema = 'public') THEN
        -- Enable RLS on nhs_terms
        ALTER TABLE public.nhs_terms ENABLE ROW LEVEL SECURITY;
        
        -- Drop any existing public access policies
        DROP POLICY IF EXISTS "Anyone can read NHS terms" ON public.nhs_terms;
        DROP POLICY IF EXISTS "NHS terms are publicly viewable" ON public.nhs_terms;
        DROP POLICY IF EXISTS "Public can view NHS terms" ON public.nhs_terms;
        DROP POLICY IF EXISTS "NHS terms are viewable by everyone" ON public.nhs_terms;
        DROP POLICY IF EXISTS "Authenticated healthcare users can view NHS terms" ON public.nhs_terms;
        DROP POLICY IF EXISTS "System admins can manage NHS terms" ON public.nhs_terms;
        
        -- Create secure policies for authenticated healthcare users only
        CREATE POLICY "Authenticated healthcare users can view NHS terms" 
        ON public.nhs_terms 
        FOR SELECT 
        TO authenticated
        USING (true);
        
        CREATE POLICY "System admins can manage NHS terms" 
        ON public.nhs_terms 
        FOR ALL 
        TO authenticated
        USING (is_system_admin(auth.uid()))
        WITH CHECK (is_system_admin(auth.uid()));
        
        -- Add security comment
        COMMENT ON TABLE public.nhs_terms IS 'NHS healthcare terminology - access restricted to authenticated healthcare professionals for data protection compliance';
        
        RAISE NOTICE 'Secured nhs_terms table - access restricted to authenticated users';
    ELSE
        RAISE NOTICE 'nhs_terms table does not exist - no action needed';
    END IF;
END
$$;

-- Check and secure cqc_domains table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cqc_domains' AND table_schema = 'public') THEN
        -- Enable RLS on cqc_domains
        ALTER TABLE public.cqc_domains ENABLE ROW LEVEL SECURITY;
        
        -- Drop any existing public access policies
        DROP POLICY IF EXISTS "Anyone can read CQC domains" ON public.cqc_domains;
        DROP POLICY IF EXISTS "CQC domains are publicly viewable" ON public.cqc_domains;
        DROP POLICY IF EXISTS "Public can view CQC domains" ON public.cqc_domains;
        DROP POLICY IF EXISTS "CQC domains are viewable by everyone" ON public.cqc_domains;
        DROP POLICY IF EXISTS "Authenticated healthcare users can view CQC domains" ON public.cqc_domains;
        DROP POLICY IF EXISTS "System admins can manage CQC domains" ON public.cqc_domains;
        
        -- Create secure policies for authenticated healthcare users only
        CREATE POLICY "Authenticated healthcare users can view CQC domains" 
        ON public.cqc_domains 
        FOR SELECT 
        TO authenticated
        USING (true);
        
        CREATE POLICY "System admins can manage CQC domains" 
        ON public.cqc_domains 
        FOR ALL 
        TO authenticated
        USING (is_system_admin(auth.uid()))
        WITH CHECK (is_system_admin(auth.uid()));
        
        -- Add security comment
        COMMENT ON TABLE public.cqc_domains IS 'CQC regulatory compliance domains - access restricted to authenticated healthcare professionals for data protection';
        
        RAISE NOTICE 'Secured cqc_domains table - access restricted to authenticated users';
    ELSE
        RAISE NOTICE 'cqc_domains table does not exist - no action needed';
    END IF;
END
$$;

-- Additional security check for any other potentially sensitive healthcare tables
DO $$
DECLARE
    tbl_name TEXT;
    policy_count INTEGER;
BEGIN
    -- Check for tables that might contain healthcare data without proper RLS
    FOR tbl_name IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('nhs_terms', 'cqc_domains', 'medical_terms', 'clinical_codes')
    LOOP
        -- Check if table has RLS enabled
        SELECT COUNT(*)
        INTO policy_count
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND c.relname = tbl_name
        AND c.relrowsecurity = true;
        
        IF policy_count = 0 THEN
            RAISE WARNING 'Table % may not have RLS enabled', tbl_name;
        END IF;
    END LOOP;
END
$$;