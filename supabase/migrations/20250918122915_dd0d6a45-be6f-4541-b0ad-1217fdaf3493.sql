-- CRITICAL SECURITY FIX: Restrict public access to sensitive healthcare data
-- Fix GDPR and NHS data protection violations (final corrected version)

-- 1. Fix news_articles table - remove public access
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on news_articles
DROP POLICY IF EXISTS "Anyone can read news articles" ON public.news_articles;
DROP POLICY IF EXISTS "Users can view published news articles" ON public.news_articles;
DROP POLICY IF EXISTS "News articles are viewable by authenticated users" ON public.news_articles;
DROP POLICY IF EXISTS "System can manage news articles" ON public.news_articles;
DROP POLICY IF EXISTS "System can insert fetched news" ON public.news_articles;
DROP POLICY IF EXISTS "System admins can manage all news articles" ON public.news_articles;
DROP POLICY IF EXISTS "Authenticated healthcare users can view news articles" ON public.news_articles;
DROP POLICY IF EXISTS "System admins can manage news articles" ON public.news_articles;

-- Create secure policies for authenticated healthcare professionals only
CREATE POLICY "Authenticated healthcare users can view news articles" 
ON public.news_articles 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "System admins can manage news articles" 
ON public.news_articles 
FOR ALL 
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- 2. Secure bank_holidays_closed_days table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bank_holidays_closed_days') THEN
        ALTER TABLE public.bank_holidays_closed_days ENABLE ROW LEVEL SECURITY;
        
        -- Drop all possible existing policies
        DROP POLICY IF EXISTS "Anyone can read bank holidays" ON public.bank_holidays_closed_days;
        DROP POLICY IF EXISTS "Bank holidays are publicly viewable" ON public.bank_holidays_closed_days;
        DROP POLICY IF EXISTS "Authenticated users can view bank holidays" ON public.bank_holidays_closed_days;
        DROP POLICY IF EXISTS "System admins can manage bank holidays" ON public.bank_holidays_closed_days;
        
        CREATE POLICY "Authenticated users can view bank holidays" 
        ON public.bank_holidays_closed_days 
        FOR SELECT 
        TO authenticated
        USING (true);
        
        CREATE POLICY "System admins can manage bank holidays" 
        ON public.bank_holidays_closed_days 
        FOR ALL 
        TO authenticated
        USING (is_system_admin(auth.uid()))
        WITH CHECK (is_system_admin(auth.uid()));
    END IF;
END
$$;

-- 3. Secure other sensitive tables
DO $$
BEGIN
    -- Secure cqc_domains if exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cqc_domains') THEN
        ALTER TABLE public.cqc_domains ENABLE ROW LEVEL SECURITY;
        
        -- Drop all existing policies
        DROP POLICY IF EXISTS "Anyone can read CQC domains" ON public.cqc_domains;
        DROP POLICY IF EXISTS "CQC domains are publicly viewable" ON public.cqc_domains;
        DROP POLICY IF EXISTS "Authenticated healthcare users can view CQC domains" ON public.cqc_domains;
        DROP POLICY IF EXISTS "System admins can manage CQC domains" ON public.cqc_domains;
        
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
    END IF;
    
    -- Secure nhs_terms if exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'nhs_terms') THEN
        ALTER TABLE public.nhs_terms ENABLE ROW LEVEL SECURITY;
        
        -- Drop all existing policies
        DROP POLICY IF EXISTS "Anyone can read NHS terms" ON public.nhs_terms;
        DROP POLICY IF EXISTS "NHS terms are publicly viewable" ON public.nhs_terms;
        DROP POLICY IF EXISTS "Authenticated healthcare users can view NHS terms" ON public.nhs_terms;
        DROP POLICY IF EXISTS "System admins can manage NHS terms" ON public.nhs_terms;
        
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
    END IF;
END
$$;

-- Add security comments for compliance documentation
COMMENT ON TABLE public.news_articles IS 'NHS healthcare news - access restricted to authenticated healthcare professionals for GDPR compliance';