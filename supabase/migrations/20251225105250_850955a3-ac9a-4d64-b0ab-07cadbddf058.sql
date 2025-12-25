-- Revoke all privileges from anon role on lg_patients table
-- This table contains highly sensitive patient medical data (NHS numbers, DOB, medical records)
-- Only authenticated users should have access, controlled by RLS

REVOKE ALL ON public.lg_patients FROM anon;

-- Ensure only authenticated users have table access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lg_patients TO authenticated;

-- Enable FORCE ROW LEVEL SECURITY to prevent bypass by table owners
ALTER TABLE public.lg_patients FORCE ROW LEVEL SECURITY;