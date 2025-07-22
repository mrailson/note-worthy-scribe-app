-- Add RLS policies and functions for complaint management

-- Create function to generate reference numbers
CREATE OR REPLACE FUNCTION generate_complaint_reference()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  reference TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the next sequence number for this year
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.complaints
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  reference := 'COMP-' || year_part || '-' || LPAD(sequence_num::TEXT, 5, '0');
  
  RETURN reference;
END;
$$;

-- Create function to automatically set response due dates
CREATE OR REPLACE FUNCTION set_complaint_due_dates()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Set acknowledgement due date (3 working days)
  -- Set response due date (20 working days)
  IF NEW.status = 'submitted' AND (OLD IS NULL OR OLD.status != 'submitted') THEN
    NEW.submitted_at = NOW();
    NEW.response_due_date = NOW() + INTERVAL '20 days';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic reference number generation
CREATE OR REPLACE FUNCTION auto_generate_reference()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number = generate_complaint_reference();
  END IF;
  RETURN NEW;
END;
$$;

-- Create function to log complaint actions
CREATE OR REPLACE FUNCTION log_complaint_action(
  p_complaint_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.complaint_audit_log (complaint_id, action, details, performed_by)
  VALUES (p_complaint_id, p_action, p_details, auth.uid())
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Create triggers
CREATE TRIGGER complaints_auto_reference
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_reference();

CREATE TRIGGER complaints_due_dates
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION set_complaint_due_dates();

CREATE TRIGGER update_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_complaint_templates_updated_at
  BEFORE UPDATE ON public.complaint_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create RLS policies for complaints
CREATE POLICY "Authenticated users can view complaints" 
ON public.complaints 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can create complaints" 
ON public.complaints 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Complaints managers and admins can update complaints" 
ON public.complaints 
FOR UPDATE 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'system_admin') OR 
  public.has_role(auth.uid(), 'complaints_manager') OR
  created_by = auth.uid()
);

-- Create RLS policies for complaint notes
CREATE POLICY "Authenticated users can view complaint notes" 
ON public.complaint_notes 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can create complaint notes" 
ON public.complaint_notes 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

-- Create RLS policies for other tables
CREATE POLICY "Authenticated users can view documents" 
ON public.complaint_documents 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can upload documents" 
ON public.complaint_documents 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can view responses" 
ON public.complaint_responses 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can create responses" 
ON public.complaint_responses 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = sent_by);

CREATE POLICY "Authenticated users can view audit log" 
ON public.complaint_audit_log 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "System creates audit log entries" 
ON public.complaint_audit_log 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = performed_by);

CREATE POLICY "Authenticated users can view templates" 
ON public.complaint_templates 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Complaints managers can manage templates" 
ON public.complaint_templates 
FOR ALL 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'system_admin') OR 
  public.has_role(auth.uid(), 'complaints_manager')
);