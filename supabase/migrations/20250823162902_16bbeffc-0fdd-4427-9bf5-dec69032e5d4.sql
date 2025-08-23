-- Create the ICN Formulary table
CREATE TABLE public.icn_formulary (
  id bigserial PRIMARY KEY,
  bnf_chapter_code text,          -- e.g. "21" (derived if present)
  bnf_chapter_name text,          -- e.g. "Gastro-intestinal system"
  section text,                   -- e.g. "Ulcer Healing Drugs"
  item_name text,                 -- e.g. "Omeprazole capsules"
  preference_rank smallint,       -- 1 = first-line, 2 = second-line, null = listed only
  is_preferred boolean,           -- convenience flag
  otc boolean DEFAULT false,      -- available OTC (from page text)
  notes text,                     -- cost notes, paeds caveats, NG-tube info, etc.
  page_url text,                  -- https://…/mo-formulary
  last_published text,            -- e.g., "12 Jun 2025 14:00"
  name_norm text GENERATED ALWAYS AS (lower(regexp_replace(item_name,'\\s+',' ','g'))) STORED,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_icn_formulary_name_norm ON public.icn_formulary (name_norm);
CREATE INDEX idx_icn_formulary_chapter_section ON public.icn_formulary (bnf_chapter_name, section);
CREATE INDEX idx_icn_formulary_preferred ON public.icn_formulary (is_preferred, preference_rank);

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

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_icn_formulary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_icn_formulary_updated_at
BEFORE UPDATE ON public.icn_formulary
FOR EACH ROW EXECUTE FUNCTION public.update_icn_formulary_updated_at();