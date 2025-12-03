-- Create SNOMED codes reference table
CREATE TABLE public.snomed_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_description TEXT NOT NULL,
  snomed_code TEXT NOT NULL,
  code_description TEXT NOT NULL,
  domain TEXT,
  source_document TEXT DEFAULT 'qsr-sfl-2019-20',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient lookups
CREATE INDEX idx_snomed_code ON public.snomed_codes(snomed_code);
CREATE INDEX idx_snomed_description_gin ON public.snomed_codes USING gin(to_tsvector('english', code_description));
CREATE INDEX idx_snomed_cluster ON public.snomed_codes(cluster_description);

-- Enable RLS
ALTER TABLE public.snomed_codes ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read (reference data)
CREATE POLICY "snomed_codes_select_all" ON public.snomed_codes
  FOR SELECT USING (true);

-- Only service role can insert/update (via edge function)
CREATE POLICY "snomed_codes_insert_service" ON public.snomed_codes
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "snomed_codes_update_service" ON public.snomed_codes
  FOR UPDATE USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE public.snomed_codes IS 'NHS SNOMED CT reference codes from QSR/SFL code list for validated clinical coding';