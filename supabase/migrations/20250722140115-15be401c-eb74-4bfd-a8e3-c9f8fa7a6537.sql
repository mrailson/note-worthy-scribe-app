-- Create complaint management system schema

-- First, extend the app_role enum to include complaint-specific roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'complaints_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';

-- Create complaint categories enum
CREATE TYPE public.complaint_category AS ENUM (
  'clinical_care',
  'staff_attitude',
  'appointment_system',
  'communication',
  'facilities',
  'billing',
  'waiting_times',
  'medication',
  'referrals',
  'other'
);

-- Create complaint status enum
CREATE TYPE public.complaint_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'response_sent',
  'closed',
  'escalated'
);

-- Create complaint priority enum
CREATE TYPE public.complaint_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- Create complaints table
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT UNIQUE NOT NULL,
  
  -- Patient information
  patient_name TEXT NOT NULL,
  patient_dob DATE,
  patient_contact_phone TEXT,
  patient_contact_email TEXT,
  patient_address TEXT,
  
  -- Complaint details
  incident_date DATE NOT NULL,
  complaint_title TEXT NOT NULL,
  complaint_description TEXT NOT NULL,
  category complaint_category NOT NULL,
  location_service TEXT,
  staff_mentioned TEXT[],
  
  -- Status and workflow
  status complaint_status NOT NULL DEFAULT 'draft',
  priority complaint_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id),
  
  -- Consent and compliance
  consent_given BOOLEAN DEFAULT false,
  consent_details TEXT,
  complaint_on_behalf BOOLEAN DEFAULT false,
  
  -- Timing and escalation
  submitted_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  response_due_date TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  practice_id UUID
);

-- Create complaint_notes table for internal notes
CREATE TABLE public.complaint_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE NOT NULL,
  note TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create complaint_documents table for file attachments
CREATE TABLE public.complaint_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create complaint_responses table for response templates and sent responses
CREATE TABLE public.complaint_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE NOT NULL,
  response_type TEXT NOT NULL, -- 'acknowledgement', 'full_response', 'escalation'
  subject TEXT,
  content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID REFERENCES auth.users(id),
  is_template BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audit log table
CREATE TABLE public.complaint_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create response templates table
CREATE TABLE public.complaint_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'acknowledgement', 'full_response', 'escalation'
  subject TEXT,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create function to generate reference numbers
CREATE OR REPLACE FUNCTION generate_complaint_reference()
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql;

-- Create function to automatically set response due dates
CREATE OR REPLACE FUNCTION set_complaint_due_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Set acknowledgement due date (3 working days)
  -- Set response due date (20 working days)
  IF NEW.status = 'submitted' AND OLD.status != 'submitted' THEN
    NEW.submitted_at = NOW();
    NEW.response_due_date = NOW() + INTERVAL '20 days';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic reference number generation
CREATE OR REPLACE FUNCTION auto_generate_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number = generate_complaint_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Enable RLS on all tables
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_templates ENABLE ROW LEVEL SECURITY;

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

-- Insert default response templates
INSERT INTO public.complaint_templates (name, template_type, subject, content, created_by) VALUES
('Standard Acknowledgement', 'acknowledgement', 'Acknowledgement of Your Complaint - Ref: {reference_number}', 
'Dear {patient_name},

Thank you for bringing your concerns to our attention. We have received your complaint (Reference: {reference_number}) and take all feedback seriously.

We aim to provide a full response within 20 working days. If you have any questions in the meantime, please contact our complaints team.

Yours sincerely,
Practice Complaints Team', 
(SELECT id FROM auth.users LIMIT 1)),

('Standard Response', 'full_response', 'Response to Your Complaint - Ref: {reference_number}',
'Dear {patient_name},

Following our investigation into your complaint (Reference: {reference_number}), I would like to provide you with our findings and response.

{response_content}

If you are not satisfied with this response, you have the right to refer your complaint to the Parliamentary and Health Service Ombudsman.

Yours sincerely,
Practice Manager', 
(SELECT id FROM auth.users LIMIT 1)),

('Escalation Letter', 'escalation', 'Escalation of Complaint - Ref: {reference_number}',
'Dear {patient_name},

Your complaint (Reference: {reference_number}) is being escalated for further review as it has not been resolved within our standard timeframe.

A senior member of our team will be in contact within 5 working days.

Yours sincerely,
Practice Manager', 
(SELECT id FROM auth.users LIMIT 1));

-- Create function to log complaint actions
CREATE OR REPLACE FUNCTION log_complaint_action(
  p_complaint_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.complaint_audit_log (complaint_id, action, details, performed_by)
  VALUES (p_complaint_id, p_action, p_details, auth.uid())
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;