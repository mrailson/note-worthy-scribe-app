-- Create table for BP session history
CREATE TABLE public.bp_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Mode
  mode TEXT NOT NULL DEFAULT 'standard', -- 'standard' or 'sit-stand'
  
  -- Summary data
  readings_count INTEGER NOT NULL DEFAULT 0,
  included_count INTEGER NOT NULL DEFAULT 0,
  excluded_count INTEGER NOT NULL DEFAULT 0,
  
  -- Averages
  avg_systolic NUMERIC(5,1),
  avg_diastolic NUMERIC(5,1),
  avg_pulse NUMERIC(5,1),
  systolic_min INTEGER,
  systolic_max INTEGER,
  diastolic_min INTEGER,
  diastolic_max INTEGER,
  
  -- NICE data
  nice_systolic NUMERIC(5,1),
  nice_diastolic NUMERIC(5,1),
  nice_category TEXT,
  nhs_category TEXT,
  
  -- Sit/Stand data (nullable for standard mode)
  sit_stand_averages JSONB,
  
  -- Full readings data for re-use
  readings JSONB NOT NULL,
  
  -- Trends and quality
  trends JSONB,
  data_quality JSONB,
  date_range JSONB,
  qof_relevance JSONB,
  
  -- Original input info
  source_text TEXT,
  source_files_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.bp_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only see their own sessions
CREATE POLICY "Users can view their own BP sessions"
  ON public.bp_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own BP sessions"
  ON public.bp_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own BP sessions"
  ON public.bp_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_bp_sessions_updated_at
  BEFORE UPDATE ON public.bp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for user queries
CREATE INDEX idx_bp_sessions_user_created ON public.bp_sessions(user_id, created_at DESC);