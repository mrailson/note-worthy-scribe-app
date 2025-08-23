-- Drop existing icn_formulary table if it exists
DROP TABLE IF EXISTS public.icn_formulary CASCADE;

-- Create icn_formulary table with the requested schema
CREATE TABLE public.icn_formulary (
  id bigserial PRIMARY KEY,
  bnf_chapter_name text,          -- e.g. "Gastro-intestinal system"
  section text,                   -- e.g. "Ulcer healing drugs"
  item_name text NOT NULL,        -- e.g. "Omeprazole capsules"
  preference_rank smallint,       -- 1=first line, 2=second line, NULL=listed-only
  is_preferred boolean GENERATED ALWAYS AS (preference_rank IN (1,2)) STORED,
  otc boolean DEFAULT false,      -- true if line marked OTC/"can be purchased"
  notes text,                     -- cost, paeds caveats, NG-tube, etc.
  page_url text NOT NULL,         -- https://…/mo-formulary
  last_published text,            -- keep as text; site uses free-text date/time
  name_norm text GENERATED ALWAYS AS (lower(regexp_replace(item_name,'\s+',' ','g'))) STORED
);

-- Create indexes
CREATE INDEX ON public.icn_formulary (name_norm);
CREATE INDEX ON public.icn_formulary (bnf_chapter_name, section);

-- Enable RLS
ALTER TABLE public.icn_formulary ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view formulary data" 
ON public.icn_formulary 
FOR SELECT 
USING (true);

CREATE POLICY "System admins can manage formulary data" 
ON public.icn_formulary 
FOR ALL 
USING (is_system_admin(auth.uid()));