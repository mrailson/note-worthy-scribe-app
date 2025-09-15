-- Create wrapper functions with SECURITY INVOKER to fix security definer view issues
-- These wrapper functions will be used in views instead of the core SECURITY DEFINER functions

-- Create a safe wrapper for unaccent function
CREATE OR REPLACE FUNCTION public.safe_unaccent(input_text text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT unaccent(input_text);
$$;

-- Create a safe wrapper for similarity function  
CREATE OR REPLACE FUNCTION public.safe_similarity(text1 text, text2 text)
RETURNS real
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT similarity(text1, text2);
$$;

-- Now recreate the problematic views using the safe wrapper functions
-- Recreate icn_pa_norm view with safe function
CREATE OR REPLACE VIEW public.icn_pa_norm AS
SELECT id,
    drug_name,
    regexp_replace(safe_unaccent(lower(drug_name)), '\([^)]*\)'::text, ' '::text, 'g'::text) AS name_norm,
    pa_status_enum,
    pa_route,
    criteria_excerpt,
    source_url,
    last_updated,
    notes
FROM icn_prior_approval;

-- Recreate icn_tl_norm view with safe function
CREATE OR REPLACE VIEW public.icn_tl_norm AS
SELECT id,
    name AS drug_name,
    regexp_replace(regexp_replace(safe_unaccent(lower(name)), '\([^)]*\)'::text, ' '::text, 'g'::text), '\b(modified[- ]?release|mr|oral|suspension|chewable|tablets?|capsules?|sachets?|injection|cream|gel|ointment|drops?|spray)\b'::text, ' '::text, 'g'::text) AS name_norm,
    status_enum,
    bnf_chapter,
    detail_url,
    updated_at AS last_modified,
    notes
FROM traffic_light_medicines;

-- Recreate icn_policy_unified_fuzzy view with safe function
CREATE OR REPLACE VIEW public.icn_policy_unified_fuzzy AS
SELECT DISTINCT ON (t.id) t.id AS tl_id,
    t.drug_name AS tl_name,
    t.status_enum AS tl_status_enum,
    t.bnf_chapter,
    t.detail_url AS tl_detail_url,
    t.last_modified AS tl_last_modified,
    t.notes AS tl_notes,
    p.id AS pa_id,
    p.drug_name AS pa_name,
    p.pa_status_enum,
    p.pa_route,
    p.criteria_excerpt,
    p.source_url AS pa_source_url,
    p.last_updated AS pa_last_updated,
    p.notes AS pa_notes,
    safe_similarity(TRIM(BOTH FROM t.name_norm), TRIM(BOTH FROM p.name_norm)) AS sim
FROM (icn_tl_norm2 t
     JOIN icn_pa_norm2 p ON ((safe_similarity(TRIM(BOTH FROM t.name_norm), TRIM(BOTH FROM p.name_norm)) >= (0.35)::double precision)))
WHERE (NOT (EXISTS ( SELECT 1
           FROM icn_policy_unified u
          WHERE ((u.tl_id = t.id) AND (u.pa_id IS NOT NULL)))))
ORDER BY t.id, (safe_similarity(TRIM(BOTH FROM t.name_norm), TRIM(BOTH FROM p.name_norm))) DESC;