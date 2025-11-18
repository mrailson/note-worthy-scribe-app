-- Create security scans table to track scan runs
CREATE TABLE IF NOT EXISTS public.security_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  total_findings integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  warn_count integer NOT NULL DEFAULT 0,
  info_count integer NOT NULL DEFAULT 0,
  scan_type text DEFAULT 'automated',
  triggered_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create security findings table to store individual findings
CREATE TABLE IF NOT EXISTS public.security_scan_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.security_scans(id) ON DELETE CASCADE,
  finding_id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  details text,
  level text NOT NULL CHECK (level IN ('error', 'warn', 'info')),
  category text,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_scan_findings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_scans
CREATE POLICY "Users can view security scans"
  ON public.security_scans
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert security scans"
  ON public.security_scans
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for security_scan_findings
CREATE POLICY "Users can view security findings"
  ON public.security_scan_findings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert security findings"
  ON public.security_scan_findings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_scans_scanned_at ON public.security_scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_findings_scan_id ON public.security_scan_findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_level ON public.security_scan_findings(level);