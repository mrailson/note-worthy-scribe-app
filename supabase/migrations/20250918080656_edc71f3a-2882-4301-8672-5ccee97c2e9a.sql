-- Secure drug reference data by removing public access
-- Only revoke from objects we know exist

-- Revoke public access from anon role for drug reference data
REVOKE SELECT ON public.icn_tl_norm FROM anon;
REVOKE SELECT ON public.icn_formulary FROM anon;

-- Grant explicit access only to authenticated users  
GRANT SELECT ON public.icn_tl_norm TO authenticated;
GRANT SELECT ON public.icn_formulary TO authenticated;

-- Create a more restrictive security model for drug data
-- This ensures only authenticated users can access pharmaceutical information
COMMENT ON TABLE public.icn_formulary IS 'Drug formulary data - restricted to authenticated users only';

-- Log the security change
INSERT INTO public.system_audit_log (
    table_name,
    operation,
    new_values
) VALUES (
    'drug_reference_security',
    'ACCESS_RESTRICTED', 
    jsonb_build_object(
        'action', 'revoked_anonymous_access',
        'tables', ARRAY['icn_tl_norm', 'icn_formulary'],
        'security_level', 'authenticated_users_only',
        'timestamp', now()
    )
);