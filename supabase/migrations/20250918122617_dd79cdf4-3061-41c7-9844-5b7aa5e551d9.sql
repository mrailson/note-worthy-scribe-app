-- Remove the icn_formulary table as it's not needed
-- This addresses the security issue by removing the problematic table entirely

-- Drop the icn_formulary table and any related objects
DROP TABLE IF EXISTS public.icn_formulary CASCADE;

-- Drop any related indexes, triggers, or functions if they exist
DROP INDEX IF EXISTS idx_icn_formulary_drug_name;
DROP INDEX IF EXISTS idx_icn_formulary_status;
DROP FUNCTION IF EXISTS public.update_icn_formulary_updated_at();

-- Clean up any related data or references
-- Note: CASCADE will handle foreign key constraints automatically