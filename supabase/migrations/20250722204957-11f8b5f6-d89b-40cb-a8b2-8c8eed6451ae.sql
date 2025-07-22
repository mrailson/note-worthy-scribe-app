-- Add data retention policies for GDPR compliance
-- This ensures data is automatically purged according to NHS retention schedules

-- Add retention policy fields to key tables
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS data_retention_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS data_retention_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS data_retention_date TIMESTAMP WITH TIME ZONE;

-- Create data retention policy table
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL UNIQUE,
  retention_period_days INTEGER NOT NULL,
  description TEXT,
  legal_basis TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default NHS retention policies
INSERT INTO public.data_retention_policies (table_name, retention_period_days, description, legal_basis) VALUES
('meetings', 2555, '7 years - NHS Records Management Code of Practice', 'Legal obligation - NHS Digital guidance'),
('communications', 2555, '7 years - NHS patient communication records', 'Legal obligation - NHS Digital guidance'),
('complaints', 3650, '10 years - NHS complaints procedure records', 'Legal obligation - NHS Complaints Procedure'),
('system_audit_log', 2555, '7 years - NHS audit trail requirements', 'Legal obligation - Information Governance'),
('meeting_transcripts', 2555, '7 years - NHS clinical records', 'Legal obligation - NHS Digital guidance'),
('meeting_summaries', 2555, '7 years - NHS clinical summaries', 'Legal obligation - NHS Digital guidance')
ON CONFLICT (table_name) DO NOTHING;

-- Enable RLS on retention policies
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing retention policies
CREATE POLICY "Authenticated users can view retention policies" 
ON public.data_retention_policies 
FOR SELECT 
USING (true);

-- Create policy for admins to manage retention policies
CREATE POLICY "System admins can manage retention policies" 
ON public.data_retention_policies 
FOR ALL 
USING (is_system_admin());

-- Create function to set retention dates automatically
CREATE OR REPLACE FUNCTION public.set_data_retention_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  retention_days INTEGER;
BEGIN
  -- Get retention period for this table
  SELECT retention_period_days INTO retention_days
  FROM public.data_retention_policies
  WHERE table_name = TG_TABLE_NAME;
  
  -- Set retention date if policy exists
  IF retention_days IS NOT NULL THEN
    NEW.data_retention_date = NOW() + (retention_days || ' days')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers to automatically set retention dates
DROP TRIGGER IF EXISTS set_meetings_retention_date ON public.meetings;
CREATE TRIGGER set_meetings_retention_date
  BEFORE INSERT ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_data_retention_date();

DROP TRIGGER IF EXISTS set_communications_retention_date ON public.communications;
CREATE TRIGGER set_communications_retention_date
  BEFORE INSERT ON public.communications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_data_retention_date();

DROP TRIGGER IF EXISTS set_complaints_retention_date ON public.complaints;
CREATE TRIGGER set_complaints_retention_date
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.set_data_retention_date();

-- Create function for data purging (to be run by scheduled job)
CREATE OR REPLACE FUNCTION public.purge_expired_data()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  purged_count INTEGER := 0;
  total_purged INTEGER := 0;
  result_text TEXT := '';
BEGIN
  -- Log the purge operation start
  PERFORM public.log_system_activity('system_maintenance', 'DATA_PURGE_START');
  
  -- Purge expired meetings
  DELETE FROM public.meetings 
  WHERE data_retention_date < NOW();
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  total_purged := total_purged + purged_count;
  result_text := result_text || 'Meetings purged: ' || purged_count || E'\n';
  
  -- Purge expired communications
  DELETE FROM public.communications 
  WHERE data_retention_date < NOW();
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  total_purged := total_purged + purged_count;
  result_text := result_text || 'Communications purged: ' || purged_count || E'\n';
  
  -- Purge expired complaints (only if closed)
  DELETE FROM public.complaints 
  WHERE data_retention_date < NOW() 
  AND status IN ('resolved', 'closed', 'rejected');
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  total_purged := total_purged + purged_count;
  result_text := result_text || 'Complaints purged: ' || purged_count || E'\n';
  
  -- Purge old audit logs (keep system audit for 7 years)
  DELETE FROM public.system_audit_log 
  WHERE timestamp < NOW() - INTERVAL '7 years';
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  total_purged := total_purged + purged_count;
  result_text := result_text || 'Audit logs purged: ' || purged_count || E'\n';
  
  result_text := result_text || 'Total records purged: ' || total_purged;
  
  -- Log the purge operation completion
  PERFORM public.log_system_activity('system_maintenance', 'DATA_PURGE_COMPLETE', NULL, NULL, 
    jsonb_build_object('total_purged', total_purged, 'details', result_text));
  
  RETURN result_text;
END;
$$;