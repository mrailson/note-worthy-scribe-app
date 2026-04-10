
CREATE TABLE public.dpia_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Practice info
  practice_name TEXT NOT NULL,
  practice_address TEXT,
  ods_code TEXT,
  practice_tel TEXT,
  pm_name TEXT,
  pm_email TEXT,
  
  -- IG
  ico_reg TEXT,
  dspt_status TEXT DEFAULT 'Standards Met',
  
  -- Caldicott Guardian
  cg_name TEXT,
  cg_role TEXT,
  cg_email TEXT,
  
  -- DPO
  dpo_name TEXT,
  dpo_org TEXT,
  dpo_email TEXT,
  dpo_tel TEXT,
  
  -- Meta
  source_file TEXT,
  completed_by TEXT,
  completed_role TEXT,
  completed_date TEXT,
  
  -- DPIA status
  dpia_generated BOOLEAN DEFAULT FALSE,
  dpia_date TEXT,
  dpia_html TEXT,
  
  -- RLS
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.dpia_practices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own DPIA records"
  ON public.dpia_practices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own DPIA records"
  ON public.dpia_practices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own DPIA records"
  ON public.dpia_practices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own DPIA records"
  ON public.dpia_practices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Updated at trigger
CREATE TRIGGER update_dpia_practices_updated_at
  BEFORE UPDATE ON public.dpia_practices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
