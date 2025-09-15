-- Drop and recreate all problematic views to remove security definer behavior
-- The issue is that views owned by postgres superuser can behave like security definer views

-- Drop all the problematic views first
DROP VIEW IF EXISTS public.icn_policy_unified_fuzzy CASCADE;
DROP VIEW IF EXISTS public.icn_policy_unified CASCADE;
DROP VIEW IF EXISTS public.icn_pa_norm2 CASCADE;
DROP VIEW IF EXISTS public.icn_tl_norm2 CASCADE;
DROP VIEW IF EXISTS public.icn_pa_norm CASCADE;
DROP VIEW IF EXISTS public.icn_tl_norm CASCADE;

-- Recreate icn_pa_norm view
CREATE VIEW public.icn_pa_norm WITH (security_invoker=true) AS
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

-- Recreate icn_tl_norm view
CREATE VIEW public.icn_tl_norm WITH (security_invoker=true) AS
SELECT id,
    name AS drug_name,
    regexp_replace(regexp_replace(safe_unaccent(lower(name)), '\([^)]*\)'::text, ' '::text, 'g'::text), '\b(modified[- ]?release|mr|oral|suspension|chewable|tablets?|capsules?|sachets?|injection|cream|gel|ointment|drops?|spray)\b'::text, ' '::text, 'g'::text) AS name_norm,
    status_enum,
    bnf_chapter,
    detail_url,
    updated_at AS last_modified,
    notes
FROM traffic_light_medicines;

-- Recreate icn_pa_norm2 view
CREATE VIEW public.icn_pa_norm2 WITH (security_invoker=true) AS
SELECT p.id,
    p.drug_name,
    p.name_norm,
    p.pa_status_enum,
    p.pa_route,
    p.criteria_excerpt,
    p.source_url,
    p.last_updated,
    p.notes,
    COALESCE(s.canonical, split_part(TRIM(BOTH FROM p.name_norm), ' '::text, 1)) AS canonical
FROM (icn_pa_norm p
     LEFT JOIN icn_policy_synonyms s ON ((s.term = split_part(TRIM(BOTH FROM p.name_norm), ' '::text, 1))));

-- Recreate icn_tl_norm2 view
CREATE VIEW public.icn_tl_norm2 WITH (security_invoker=true) AS
SELECT t.id,
    t.drug_name,
    t.name_norm,
    t.status_enum,
    t.bnf_chapter,
    t.detail_url,
    t.last_modified,
    t.notes,
    COALESCE(s.canonical, split_part(TRIM(BOTH FROM t.name_norm), ' '::text, 1)) AS canonical
FROM (icn_tl_norm t
     LEFT JOIN icn_policy_synonyms s ON ((s.term = split_part(TRIM(BOTH FROM t.name_norm), ' '::text, 1))));

-- Recreate icn_policy_unified view
CREATE VIEW public.icn_policy_unified WITH (security_invoker=true) AS
SELECT t.id AS tl_id,
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
    p.notes AS pa_notes
FROM (icn_tl_norm2 t
     LEFT JOIN icn_pa_norm2 p ON (((TRIM(BOTH FROM p.name_norm) = TRIM(BOTH FROM t.name_norm)) OR (p.canonical = t.canonical))));

-- Recreate icn_policy_unified_fuzzy view
CREATE VIEW public.icn_policy_unified_fuzzy WITH (security_invoker=true) AS
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