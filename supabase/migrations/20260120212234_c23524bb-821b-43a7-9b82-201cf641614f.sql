-- Create appointment status enum
CREATE TYPE public.appointment_status AS ENUM (
  'pending',
  'in_progress', 
  'completed',
  'requires_action'
);

-- Create appointments table
CREATE TABLE public.gp_appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Session reference (date/time of appointment list)
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_name TEXT,
  
  -- Appointment time slot
  appointment_time TIME,
  
  -- Patient details
  patient_name TEXT NOT NULL,
  nhs_number TEXT,
  date_of_birth DATE,
  address TEXT,
  postcode TEXT,
  contact_number TEXT,
  
  -- Appointment details
  reason TEXT,
  appointment_type TEXT,
  reviewing_clinician TEXT,
  
  -- Status tracking
  status appointment_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  
  -- Linked consultation (auto-linked by NHS number or manual)
  linked_consultation_id UUID REFERENCES public.gp_consultations(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_gp_appointments_user_id ON public.gp_appointments(user_id);
CREATE INDEX idx_gp_appointments_session_date ON public.gp_appointments(session_date);
CREATE INDEX idx_gp_appointments_nhs_number ON public.gp_appointments(nhs_number);
CREATE INDEX idx_gp_appointments_status ON public.gp_appointments(status);

-- Enable RLS
ALTER TABLE public.gp_appointments ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access their own appointments
CREATE POLICY "Users can view their own appointments"
ON public.gp_appointments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appointments"
ON public.gp_appointments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments"
ON public.gp_appointments
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointments"
ON public.gp_appointments
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_gp_appointments_updated_at
BEFORE UPDATE ON public.gp_appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();