-- Enable extensions for text search and normalization
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create prior approval table for ICN PA/IFR/Blueteq rules
CREATE TABLE public.icn_prior_approval (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_name TEXT NOT NULL,
    pa_status_enum TEXT NOT NULL CHECK (pa_status_enum IN ('DOUBLE_RED','RED','AMBER_2','AMBER_1','GREY','UNKNOWN')),
    pa_route TEXT NOT NULL CHECK (pa_route IN ('PRIOR_APPROVAL','IFR','BLUETEQ','OTHER')),
    criteria_excerpt TEXT,
    source_url TEXT,
    last_updated TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for prior approval lookups
CREATE INDEX idx_icn_prior_approval_drug_name ON public.icn_prior_approval(drug_name);
CREATE INDEX idx_icn_prior_approval_pa_status ON public.icn_prior_approval(pa_status_enum);

-- Create synonyms table for brand/generic mappings
CREATE TABLE public.icn_policy_synonyms (
    term TEXT PRIMARY KEY,
    canonical TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert some common synonyms
INSERT INTO public.icn_policy_synonyms(term, canonical) VALUES
('praluent','alirocumab'),
('otezla','apremilast'),
('espranor','buprenorphine'),
('acarizax','acarizax');

-- Create normalized view for traffic light medicines
CREATE OR REPLACE VIEW public.icn_tl_norm AS
SELECT 
    id,
    name as drug_name,
    regexp_replace(
        regexp_replace(
            unaccent(lower(name)),
            '\([^)]*\)', ' ', 'g'          -- drop bracketed text
        ),
        '\b(modified[- ]?release|mr|oral|suspension|chewable|tablets?|capsules?|sachets?|injection|cream|gel|ointment|drops?|spray)\b',
        ' ', 'g'
    ) as name_norm,
    status_enum, 
    bnf_chapter, 
    detail_url, 
    updated_at as last_modified,
    notes
FROM public.traffic_light_medicines;

-- Create normalized view for prior approval
CREATE OR REPLACE VIEW public.icn_pa_norm AS
SELECT 
    id,
    drug_name,
    regexp_replace(
        unaccent(lower(drug_name)), 
        '\([^)]*\)', ' ', 'g'
    ) as name_norm,
    pa_status_enum, 
    pa_route, 
    criteria_excerpt, 
    source_url, 
    last_updated,
    notes
FROM public.icn_prior_approval;

-- Create canonical views with synonym resolution
CREATE OR REPLACE VIEW public.icn_tl_norm2 AS
SELECT 
    t.*, 
    COALESCE(s.canonical, split_part(trim(t.name_norm), ' ', 1)) as canonical
FROM public.icn_tl_norm t
LEFT JOIN public.icn_policy_synonyms s ON s.term = split_part(trim(t.name_norm), ' ', 1);

CREATE OR REPLACE VIEW public.icn_pa_norm2 AS
SELECT 
    p.*, 
    COALESCE(s.canonical, split_part(trim(p.name_norm), ' ', 1)) as canonical
FROM public.icn_pa_norm p
LEFT JOIN public.icn_policy_synonyms s ON s.term = split_part(trim(p.name_norm), ' ', 1);

-- Create unified policy view (exact and canonical matches)
CREATE OR REPLACE VIEW public.icn_policy_unified AS
SELECT
    t.id as tl_id,
    t.drug_name as tl_name,
    t.status_enum as tl_status_enum,
    t.bnf_chapter,
    t.detail_url as tl_detail_url,
    t.last_modified as tl_last_modified,
    t.notes as tl_notes,
    p.id as pa_id,
    p.drug_name as pa_name,
    p.pa_status_enum,
    p.pa_route,
    p.criteria_excerpt,
    p.source_url as pa_source_url,
    p.last_updated as pa_last_updated,
    p.notes as pa_notes
FROM public.icn_tl_norm2 t
LEFT JOIN public.icn_pa_norm2 p
    ON (trim(p.name_norm) = trim(t.name_norm) OR p.canonical = t.canonical);

-- Create fuzzy fallback view for unmatched items
CREATE OR REPLACE VIEW public.icn_policy_unified_fuzzy AS
SELECT DISTINCT ON (t.id)
    t.id as tl_id, 
    t.drug_name as tl_name, 
    t.status_enum as tl_status_enum,
    t.bnf_chapter, 
    t.detail_url as tl_detail_url, 
    t.last_modified as tl_last_modified,
    t.notes as tl_notes,
    p.id as pa_id, 
    p.drug_name as pa_name, 
    p.pa_status_enum, 
    p.pa_route,
    p.criteria_excerpt, 
    p.source_url as pa_source_url, 
    p.last_updated as pa_last_updated,
    p.notes as pa_notes,
    similarity(trim(t.name_norm), trim(p.name_norm)) as sim
FROM public.icn_tl_norm2 t
JOIN public.icn_pa_norm2 p
    ON similarity(trim(t.name_norm), trim(p.name_norm)) >= 0.35
WHERE NOT EXISTS (
    SELECT 1 FROM public.icn_policy_unified u 
    WHERE u.tl_id = t.id AND u.pa_id IS NOT NULL
)
ORDER BY t.id, sim DESC;

-- Enable RLS on new tables
ALTER TABLE public.icn_prior_approval ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icn_policy_synonyms ENABLE ROW LEVEL SECURITY;

-- Create policies for prior approval table
CREATE POLICY "Authenticated users can view prior approval rules" 
ON public.icn_prior_approval 
FOR SELECT 
USING (true);

CREATE POLICY "System admins can manage prior approval rules" 
ON public.icn_prior_approval 
FOR ALL 
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Create policies for synonyms table  
CREATE POLICY "Authenticated users can view synonyms" 
ON public.icn_policy_synonyms 
FOR SELECT 
USING (true);

CREATE POLICY "System admins can manage synonyms" 
ON public.icn_policy_synonyms 
FOR ALL 
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Add trigger for updating timestamps
CREATE TRIGGER update_icn_prior_approval_updated_at
    BEFORE UPDATE ON public.icn_prior_approval
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();