-- Create supplier incidents table for DCB0160/DCB0129 compliance monitoring
CREATE TABLE public.supplier_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_reference TEXT NOT NULL UNIQUE,
  reported_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reported_by UUID NOT NULL,
  supplier_name TEXT NOT NULL,
  system_component TEXT NOT NULL,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('yellow_card', 'adverse_event', 'system_failure', 'data_breach', 'usability_issue', 'performance_issue')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
  description TEXT NOT NULL,
  impact_assessment TEXT,
  immediate_actions_taken TEXT,
  root_cause_analysis TEXT,
  corrective_actions TEXT,
  preventive_actions TEXT,
  target_completion_date DATE,
  actual_completion_date DATE,
  status TEXT NOT NULL CHECK (status IN ('reported', 'investigating', 'action_required', 'monitoring', 'closed')) DEFAULT 'reported',
  dcb0160_compliant BOOLEAN DEFAULT false,
  dcb0129_compliant BOOLEAN DEFAULT false,
  regulatory_notification_required BOOLEAN DEFAULT false,
  regulatory_notification_sent BOOLEAN DEFAULT false,
  regulatory_notification_date DATE,
  lessons_learned TEXT,
  practice_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID
);

-- Create indexes for better performance
CREATE INDEX idx_supplier_incidents_practice_id ON public.supplier_incidents(practice_id);
CREATE INDEX idx_supplier_incidents_status ON public.supplier_incidents(status);
CREATE INDEX idx_supplier_incidents_severity ON public.supplier_incidents(severity);
CREATE INDEX idx_supplier_incidents_reported_date ON public.supplier_incidents(reported_date);
CREATE INDEX idx_supplier_incidents_supplier_name ON public.supplier_incidents(supplier_name);

-- Enable RLS
ALTER TABLE public.supplier_incidents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view supplier incidents for their practices"
ON public.supplier_incidents
FOR SELECT
USING (
  practice_id = ANY(get_user_practice_ids(auth.uid())) OR
  is_system_admin(auth.uid())
);

CREATE POLICY "Authorized users can create supplier incidents"
ON public.supplier_incidents
FOR INSERT
WITH CHECK (
  auth.uid() = reported_by AND
  (practice_id = ANY(get_user_practice_ids(auth.uid())) OR is_system_admin(auth.uid()))
);

CREATE POLICY "Authorized users can update supplier incidents"
ON public.supplier_incidents
FOR UPDATE
USING (
  practice_id = ANY(get_user_practice_ids(auth.uid())) OR
  is_system_admin(auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_supplier_incidents_updated_at
  BEFORE UPDATE ON public.supplier_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate incident reference numbers
CREATE OR REPLACE FUNCTION public.generate_incident_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  reference TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the next sequence number for this year
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.supplier_incidents
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  reference := 'SI' || year_part || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN reference;
END;
$$;

-- Create trigger to auto-generate incident reference
CREATE OR REPLACE FUNCTION public.auto_generate_incident_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.incident_reference IS NULL OR NEW.incident_reference = '' THEN
    NEW.incident_reference = generate_incident_reference();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_incident_reference_trigger
  BEFORE INSERT ON public.supplier_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_incident_reference();