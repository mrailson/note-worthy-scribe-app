-- Create CSO registrations table
CREATE TABLE IF NOT EXISTS public.cso_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  gmc_number TEXT NOT NULL UNIQUE,
  practice_name TEXT NOT NULL,
  practice_address TEXT NOT NULL,
  practice_postcode TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create CSO training progress table
CREATE TABLE IF NOT EXISTS public.cso_training_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.cso_registrations(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(registration_id, module_id)
);

-- Create CSO assessments table
CREATE TABLE IF NOT EXISTS public.cso_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.cso_registrations(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  questions_answered JSONB NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage DECIMAL NOT NULL,
  passed BOOLEAN NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create CSO certificates table
CREATE TABLE IF NOT EXISTS public.cso_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.cso_registrations(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assessment_id UUID NOT NULL REFERENCES public.cso_assessments(id) ON DELETE CASCADE,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cso_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cso_training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cso_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cso_certificates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cso_registrations
CREATE POLICY "Anyone can register (insert only)"
  ON public.cso_registrations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own registration via token"
  ON public.cso_registrations
  FOR SELECT
  USING (access_token = current_setting('request.headers', true)::json->>'x-registration-token');

-- RLS Policies for cso_training_progress
CREATE POLICY "Users can view their own progress"
  ON public.cso_training_progress
  FOR SELECT
  USING (
    registration_id IN (
      SELECT id FROM public.cso_registrations 
      WHERE access_token = current_setting('request.headers', true)::json->>'x-registration-token'
    )
  );

CREATE POLICY "Users can insert their own progress"
  ON public.cso_training_progress
  FOR INSERT
  WITH CHECK (
    registration_id IN (
      SELECT id FROM public.cso_registrations 
      WHERE access_token = current_setting('request.headers', true)::json->>'x-registration-token'
    )
  );

CREATE POLICY "Users can update their own progress"
  ON public.cso_training_progress
  FOR UPDATE
  USING (
    registration_id IN (
      SELECT id FROM public.cso_registrations 
      WHERE access_token = current_setting('request.headers', true)::json->>'x-registration-token'
    )
  );

-- RLS Policies for cso_assessments
CREATE POLICY "Users can view their own assessments"
  ON public.cso_assessments
  FOR SELECT
  USING (
    registration_id IN (
      SELECT id FROM public.cso_registrations 
      WHERE access_token = current_setting('request.headers', true)::json->>'x-registration-token'
    )
  );

CREATE POLICY "Users can insert their own assessments"
  ON public.cso_assessments
  FOR INSERT
  WITH CHECK (
    registration_id IN (
      SELECT id FROM public.cso_registrations 
      WHERE access_token = current_setting('request.headers', true)::json->>'x-registration-token'
    )
  );

-- RLS Policies for cso_certificates
CREATE POLICY "Users can view their own certificates"
  ON public.cso_certificates
  FOR SELECT
  USING (
    registration_id IN (
      SELECT id FROM public.cso_registrations 
      WHERE access_token = current_setting('request.headers', true)::json->>'x-registration-token'
    )
  );

CREATE POLICY "Certificates can be inserted via service role only"
  ON public.cso_certificates
  FOR INSERT
  WITH CHECK (true);

-- Create storage bucket for certificates
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cso-certificates', 'cso-certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for certificates
CREATE POLICY "Certificate PDFs are publicly readable"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'cso-certificates');

CREATE POLICY "Service role can upload certificates"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'cso-certificates');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cso_registrations_email ON public.cso_registrations(email);
CREATE INDEX IF NOT EXISTS idx_cso_registrations_gmc ON public.cso_registrations(gmc_number);
CREATE INDEX IF NOT EXISTS idx_cso_registrations_token ON public.cso_registrations(access_token);
CREATE INDEX IF NOT EXISTS idx_cso_progress_registration ON public.cso_training_progress(registration_id);
CREATE INDEX IF NOT EXISTS idx_cso_assessments_registration ON public.cso_assessments(registration_id);
CREATE INDEX IF NOT EXISTS idx_cso_certificates_registration ON public.cso_certificates(registration_id);
CREATE INDEX IF NOT EXISTS idx_cso_certificates_number ON public.cso_certificates(certificate_number);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_cso_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_cso_registrations_updated_at
  BEFORE UPDATE ON public.cso_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cso_updated_at();

CREATE TRIGGER update_cso_training_progress_updated_at
  BEFORE UPDATE ON public.cso_training_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cso_updated_at();