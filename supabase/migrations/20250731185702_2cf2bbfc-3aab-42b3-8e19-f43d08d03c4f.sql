-- Create CQC compliance database tables

-- CQC domains reference
CREATE TABLE public.cqc_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  weight DECIMAL(5,2) DEFAULT 20.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert CQC domains
INSERT INTO public.cqc_domains (name, description) VALUES
('safe', 'By safe, we mean people are protected from abuse and avoidable harm'),
('effective', 'By effective, we mean care, treatment and support achieves good outcomes'),
('caring', 'By caring, we mean staff involve and treat people with compassion'),
('responsive', 'By responsive, we mean services are organised to meet people''s needs'),
('well_led', 'By well-led, we mean leadership, management and governance assures delivery');

-- Practice compliance settings
CREATE TABLE public.cqc_practice_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID,
  next_inspection_date DATE,
  last_inspection_date DATE,
  current_rating TEXT,
  notifications_enabled BOOLEAN DEFAULT true,
  email_alerts BOOLEAN DEFAULT true,
  sms_alerts BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID
);

-- Policy management
CREATE TABLE public.cqc_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  policy_type TEXT NOT NULL,
  cqc_domain TEXT,
  version TEXT DEFAULT '1.0',
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  expiry_date DATE,
  review_date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'archived')),
  ai_compliance_score INTEGER CHECK (ai_compliance_score >= 0 AND ai_compliance_score <= 100),
  ai_feedback JSONB,
  uploaded_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Evidence management
CREATE TABLE public.cqc_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  evidence_type TEXT NOT NULL,
  cqc_domain TEXT,
  kloe_reference TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  tags TEXT[],
  expiry_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'archived')),
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Self-assessment checklist
CREATE TABLE public.cqc_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID,
  assessment_date DATE DEFAULT CURRENT_DATE,
  cqc_domain TEXT,
  kloe_reference TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  compliance_status TEXT DEFAULT 'not_assessed' CHECK (compliance_status IN ('compliant', 'partially_compliant', 'non_compliant', 'not_assessed')),
  evidence_ids UUID[],
  notes TEXT,
  action_required BOOLEAN DEFAULT false,
  action_description TEXT,
  action_due_date DATE,
  completed_by UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CQC guidance updates
CREATE TABLE public.cqc_guidance_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  source_url TEXT,
  published_date DATE,
  cqc_domain TEXT,
  impact_level TEXT DEFAULT 'medium' CHECK (impact_level IN ('low', 'medium', 'high')),
  tags TEXT[],
  ai_summary TEXT,
  requires_policy_review BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CQC alerts and tasks
CREATE TABLE public.cqc_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'resolved')),
  due_date DATE,
  related_policy_id UUID,
  related_evidence_id UUID,
  created_by UUID,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CQC AI chat sessions
CREATE TABLE public.cqc_ai_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID,
  user_id UUID,
  session_title TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  session_summary TEXT,
  exported_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cqc_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cqc_practice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cqc_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cqc_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cqc_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cqc_guidance_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cqc_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cqc_ai_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for CQC domains (read-only for all authenticated users)
CREATE POLICY "CQC domains are viewable by authenticated users" 
ON public.cqc_domains FOR SELECT 
USING (true);

-- RLS Policies for practice settings
CREATE POLICY "Users can view settings for their practices" 
ON public.cqc_practice_settings FOR SELECT 
USING (practice_id = ANY(get_user_practice_ids()));

CREATE POLICY "Practice managers can manage settings" 
ON public.cqc_practice_settings FOR ALL 
USING (practice_id = ANY(get_user_practice_ids()) AND 
       (has_role(auth.uid(), 'practice_manager'::app_role) OR has_role(auth.uid(), 'system_admin'::app_role)));

-- RLS Policies for policies
CREATE POLICY "Users can view policies for their practices" 
ON public.cqc_policies FOR SELECT 
USING (practice_id = ANY(get_user_practice_ids()));

CREATE POLICY "Practice managers can manage policies" 
ON public.cqc_policies FOR ALL 
USING (practice_id = ANY(get_user_practice_ids()) AND 
       (has_role(auth.uid(), 'practice_manager'::app_role) OR has_role(auth.uid(), 'system_admin'::app_role)));

-- RLS Policies for evidence
CREATE POLICY "Users can view evidence for their practices" 
ON public.cqc_evidence FOR SELECT 
USING (practice_id = ANY(get_user_practice_ids()));

CREATE POLICY "Practice managers can manage evidence" 
ON public.cqc_evidence FOR ALL 
USING (practice_id = ANY(get_user_practice_ids()) AND 
       (has_role(auth.uid(), 'practice_manager'::app_role) OR has_role(auth.uid(), 'system_admin'::app_role)));

-- RLS Policies for assessments
CREATE POLICY "Users can view assessments for their practices" 
ON public.cqc_assessments FOR SELECT 
USING (practice_id = ANY(get_user_practice_ids()));

CREATE POLICY "Practice managers can manage assessments" 
ON public.cqc_assessments FOR ALL 
USING (practice_id = ANY(get_user_practice_ids()) AND 
       (has_role(auth.uid(), 'practice_manager'::app_role) OR has_role(auth.uid(), 'system_admin'::app_role)));

-- RLS Policies for guidance updates (read-only for all authenticated users)
CREATE POLICY "Guidance updates are viewable by authenticated users" 
ON public.cqc_guidance_updates FOR SELECT 
USING (true);

-- RLS Policies for alerts
CREATE POLICY "Users can view alerts for their practices" 
ON public.cqc_alerts FOR SELECT 
USING (practice_id = ANY(get_user_practice_ids()));

CREATE POLICY "Practice managers can manage alerts" 
ON public.cqc_alerts FOR ALL 
USING (practice_id = ANY(get_user_practice_ids()) AND 
       (has_role(auth.uid(), 'practice_manager'::app_role) OR has_role(auth.uid(), 'system_admin'::app_role)));

-- RLS Policies for AI sessions
CREATE POLICY "Users can view their own AI sessions" 
ON public.cqc_ai_sessions FOR SELECT 
USING (user_id = auth.uid() AND practice_id = ANY(get_user_practice_ids()));

CREATE POLICY "Users can create AI sessions for their practices" 
ON public.cqc_ai_sessions FOR INSERT 
WITH CHECK (user_id = auth.uid() AND practice_id = ANY(get_user_practice_ids()));

CREATE POLICY "Users can update their own AI sessions" 
ON public.cqc_ai_sessions FOR UPDATE 
USING (user_id = auth.uid() AND practice_id = ANY(get_user_practice_ids()));

-- Create storage bucket for CQC documents
INSERT INTO storage.buckets (id, name, public) VALUES ('cqc-documents', 'cqc-documents', false);

-- Storage policies for CQC documents
CREATE POLICY "Users can view CQC documents for their practices" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'cqc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload CQC documents for their practices" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'cqc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update CQC documents for their practices" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'cqc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete CQC documents for their practices" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'cqc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create triggers for updated_at
CREATE TRIGGER update_cqc_practice_settings_updated_at
  BEFORE UPDATE ON public.cqc_practice_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cqc_policies_updated_at
  BEFORE UPDATE ON public.cqc_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cqc_evidence_updated_at
  BEFORE UPDATE ON public.cqc_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cqc_assessments_updated_at
  BEFORE UPDATE ON public.cqc_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cqc_ai_sessions_updated_at
  BEFORE UPDATE ON public.cqc_ai_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();