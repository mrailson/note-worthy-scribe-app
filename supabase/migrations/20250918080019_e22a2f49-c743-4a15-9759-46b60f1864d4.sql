-- Add RLS policies to restrict drug reference tables to authenticated users only

-- Enable RLS on icn_tl_norm if not already enabled
ALTER TABLE public.icn_tl_norm ENABLE ROW LEVEL SECURITY;

-- Add authenticated user policy for icn_tl_norm
DROP POLICY IF EXISTS "Authenticated users can view drug reference data" ON public.icn_tl_norm;
CREATE POLICY "Authenticated users can view drug reference data" 
ON public.icn_tl_norm 
FOR SELECT 
TO authenticated
USING (true);

-- Enable RLS on icn_formulary if not already enabled  
ALTER TABLE public.icn_formulary ENABLE ROW LEVEL SECURITY;

-- Update icn_formulary policy to require authentication
DROP POLICY IF EXISTS "Authenticated users can view formulary data" ON public.icn_formulary;
CREATE POLICY "Authenticated users can view formulary data" 
ON public.icn_formulary 
FOR SELECT 
TO authenticated
USING (true);

-- Create tables and policies for other drug reference tables if they exist
-- icn_pa_norm table
CREATE TABLE IF NOT EXISTS public.icn_pa_norm (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_name text,
    name_norm text,
    status_enum text,
    bnf_chapter text,
    detail_url text,
    notes text,
    last_modified timestamp with time zone DEFAULT now()
);

ALTER TABLE public.icn_pa_norm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view PA drug data" 
ON public.icn_pa_norm 
FOR SELECT 
TO authenticated
USING (true);

-- icn_policy_unified table
CREATE TABLE IF NOT EXISTS public.icn_policy_unified (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_name text,
    name_norm text,
    status_enum text,
    bnf_chapter text,
    detail_url text,
    notes text,
    policy_type text,
    last_modified timestamp with time zone DEFAULT now()
);

ALTER TABLE public.icn_policy_unified ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view unified policy data" 
ON public.icn_policy_unified 
FOR SELECT 
TO authenticated
USING (true);

-- icn_policy_unified_fuzzy table
CREATE TABLE IF NOT EXISTS public.icn_policy_unified_fuzzy (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_name text,
    name_norm text,
    status_enum text,
    similarity_score numeric,
    matched_drug text,
    last_modified timestamp with time zone DEFAULT now()
);

ALTER TABLE public.icn_policy_unified_fuzzy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fuzzy policy data" 
ON public.icn_policy_unified_fuzzy 
FOR SELECT 
TO authenticated
USING (true);

-- icn_tl_norm2 table
CREATE TABLE IF NOT EXISTS public.icn_tl_norm2 (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_name text,
    name_norm text,
    status_enum text,
    bnf_chapter text,
    detail_url text,
    notes text,
    version integer DEFAULT 2,
    last_modified timestamp with time zone DEFAULT now()
);

ALTER TABLE public.icn_tl_norm2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view drug reference data v2" 
ON public.icn_tl_norm2 
FOR SELECT 
TO authenticated
USING (true);

-- icn_pa_norm2 table  
CREATE TABLE IF NOT EXISTS public.icn_pa_norm2 (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_name text,
    name_norm text,
    status_enum text,
    bnf_chapter text,
    detail_url text,
    notes text,
    version integer DEFAULT 2,
    last_modified timestamp with time zone DEFAULT now()
);

ALTER TABLE public.icn_pa_norm2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view PA drug data v2" 
ON public.icn_pa_norm2 
FOR SELECT 
TO authenticated
USING (true);

-- Remove public access - revoke permissions from anon role
REVOKE SELECT ON public.icn_tl_norm FROM anon;
REVOKE SELECT ON public.icn_formulary FROM anon;
REVOKE ALL ON public.icn_pa_norm FROM anon;
REVOKE ALL ON public.icn_policy_unified FROM anon;
REVOKE ALL ON public.icn_policy_unified_fuzzy FROM anon;
REVOKE ALL ON public.icn_tl_norm2 FROM anon;
REVOKE ALL ON public.icn_pa_norm2 FROM anon;