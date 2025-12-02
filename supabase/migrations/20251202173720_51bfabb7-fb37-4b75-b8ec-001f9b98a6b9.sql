-- Create lg_patients table for Lloyd George capture records
CREATE TABLE public.lg_patients (
  id TEXT PRIMARY KEY,  -- ULID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  practice_ods TEXT NOT NULL,
  uploader_name TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  nhs_number TEXT NOT NULL,
  dob DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('male', 'female', 'other', 'unknown')),
  images_count INTEGER DEFAULT 0,
  job_status TEXT DEFAULT 'draft' CHECK (job_status IN ('draft', 'uploading', 'queued', 'processing', 'succeeded', 'failed')),
  pdf_url TEXT,
  summary_json_url TEXT,
  snomed_json_url TEXT,
  snomed_csv_url TEXT,
  error_message TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ
);

-- Create lg_audit_logs table for audit trail
CREATE TABLE public.lg_audit_logs (
  id TEXT PRIMARY KEY,  -- ULID
  patient_id TEXT REFERENCES public.lg_patients(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_user_id UUID,
  at TIMESTAMPTZ DEFAULT NOW(),
  meta JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for common queries
CREATE INDEX idx_lg_patients_user_id ON public.lg_patients(user_id);
CREATE INDEX idx_lg_patients_practice_ods ON public.lg_patients(practice_ods);
CREATE INDEX idx_lg_patients_nhs_number ON public.lg_patients(nhs_number);
CREATE INDEX idx_lg_patients_job_status ON public.lg_patients(job_status);
CREATE INDEX idx_lg_audit_logs_patient_id ON public.lg_audit_logs(patient_id);

-- Enable RLS
ALTER TABLE public.lg_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lg_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lg_patients
CREATE POLICY "Users can view own lg_patients" ON public.lg_patients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lg_patients" ON public.lg_patients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lg_patients" ON public.lg_patients
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lg_patients" ON public.lg_patients
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for lg_audit_logs
CREATE POLICY "Users can view own lg_audit_logs" ON public.lg_audit_logs
  FOR SELECT USING (patient_id IN (SELECT id FROM public.lg_patients WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert audit logs for own patients" ON public.lg_audit_logs
  FOR INSERT WITH CHECK (patient_id IN (SELECT id FROM public.lg_patients WHERE user_id = auth.uid()) OR actor_user_id = auth.uid());

-- Create storage bucket for LG files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lg', 'lg', false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/json', 'text/csv'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for lg bucket
CREATE POLICY "Users can upload to own lg folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'lg' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view own lg files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'lg' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update own lg files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'lg' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete own lg files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'lg' AND 
    auth.uid() IS NOT NULL
  );

-- Trigger to update updated_at
CREATE TRIGGER update_lg_patients_updated_at
  BEFORE UPDATE ON public.lg_patients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();