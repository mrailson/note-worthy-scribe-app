-- Secure drug reference data by removing public access
-- Simple approach - just revoke and grant permissions

-- Revoke public access from anon role for drug reference data
REVOKE SELECT ON public.icn_tl_norm FROM anon;
REVOKE SELECT ON public.icn_formulary FROM anon;

-- Grant explicit access only to authenticated users  
GRANT SELECT ON public.icn_tl_norm TO authenticated;
GRANT SELECT ON public.icn_formulary TO authenticated;

-- Add security comment
COMMENT ON TABLE public.icn_formulary IS 'Drug formulary data - restricted to authenticated users only for security';