-- Secure drug reference data by removing public access
-- Focus on revoking permissions since some are views, not tables

-- Revoke public access from anon role for all drug reference views/tables
-- This will require authentication to access the data

-- For icn_tl_norm (view)
REVOKE SELECT ON public.icn_tl_norm FROM anon;
REVOKE SELECT ON public.icn_tl_norm FROM public;

-- For icn_formulary (table - already has RLS)
REVOKE SELECT ON public.icn_formulary FROM anon;
REVOKE SELECT ON public.icn_formulary FROM public;

-- For other potential drug reference objects
REVOKE SELECT ON public.icn_pa_norm FROM anon IF EXISTS;
REVOKE SELECT ON public.icn_pa_norm FROM public IF EXISTS;

-- Grant explicit access only to authenticated users
GRANT SELECT ON public.icn_tl_norm TO authenticated;
GRANT SELECT ON public.icn_formulary TO authenticated;

-- Ensure no other public access exists
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Grant back necessary permissions to authenticated users only
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;