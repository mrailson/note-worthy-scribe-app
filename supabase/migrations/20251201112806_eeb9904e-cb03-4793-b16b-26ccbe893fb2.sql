
-- Fix Security Definer Views by converting them to Security Invoker
-- This ensures RLS policies are enforced based on the querying user

-- Fix public_fridge_qr_view
ALTER VIEW public.public_fridge_qr_view SET (security_invoker = true);

-- Fix public_practice_feedback  
ALTER VIEW public.public_practice_feedback SET (security_invoker = true);

-- Fix security_audit_functions
ALTER VIEW public.security_audit_functions SET (security_invoker = true);
