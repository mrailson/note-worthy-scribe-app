-- Check and secure existing drug reference tables with proper RLS
-- Skip views and only apply RLS to actual tables

-- First, let's secure icn_formulary (this is a real table)
ALTER TABLE public.icn_formulary ENABLE ROW LEVEL SECURITY;

-- Update icn_formulary policy to require authentication only
DROP POLICY IF EXISTS "Authenticated users can view formulary data" ON public.icn_formulary;
CREATE POLICY "Authenticated users can view formulary data" 
ON public.icn_formulary 
FOR SELECT 
TO authenticated
USING (true);

-- Remove public access from anon role for icn_formulary
REVOKE SELECT ON public.icn_formulary FROM anon;

-- For icn_tl_norm (if it's a view), we need to secure the underlying tables
-- Let's create the missing tables with proper RLS from the start

-- icn_pa_norm table (if it doesn't exist)
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

-- Revoke public access
REVOKE ALL ON public.icn_pa_norm FROM anon;

-- If there are other drug reference tables as actual tables, secure them
-- Note: Views cannot have RLS directly, they inherit from underlying tables