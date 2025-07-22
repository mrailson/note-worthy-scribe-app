-- Create complaint management system schema

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

-- Enable RLS on all tables
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_templates ENABLE ROW LEVEL SECURITY;