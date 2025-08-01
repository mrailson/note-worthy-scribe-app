-- Create contractors table for storing contractor profiles
CREATE TABLE public.contractors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  trade TEXT NOT NULL,
  availability_status TEXT DEFAULT 'unknown',
  availability_date DATE,
  overall_score INTEGER DEFAULT 0,
  experience_score INTEGER DEFAULT 0,
  certification_score INTEGER DEFAULT 0,
  availability_score INTEGER DEFAULT 0,
  completeness_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'needs_review', 'rejected')),
  ai_summary TEXT,
  red_flags TEXT[],
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contractor_resumes table for storing uploaded resumes
CREATE TABLE public.contractor_resumes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  parsed_content TEXT,
  raw_extracted_data JSONB,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contractor_competencies table for storing extracted skills and certifications
CREATE TABLE public.contractor_competencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  competency_type TEXT NOT NULL CHECK (competency_type IN ('skill', 'certification', 'tool', 'system')),
  name TEXT NOT NULL,
  level TEXT DEFAULT 'unknown' CHECK (level IN ('unknown', 'basic', 'intermediate', 'advanced', 'expert')),
  verified BOOLEAN DEFAULT false,
  expiry_date DATE,
  issuing_body TEXT,
  extracted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contractor_experience table for work history
CREATE TABLE public.contractor_experience (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  employer TEXT NOT NULL,
  position TEXT,
  start_date DATE,
  end_date DATE,
  description TEXT,
  is_current BOOLEAN DEFAULT false,
  extracted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contractor_recommendations table for AI-generated recommendations
CREATE TABLE public.contractor_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('question', 'concern', 'follow_up', 'action')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'addressed', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contractor_notes table for recruiter notes
CREATE TABLE public.contractor_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'interview', 'reference', 'follow_up')),
  title TEXT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contractors
CREATE POLICY "Users can view contractors for their practices" 
ON public.contractors FOR SELECT 
USING (true); -- Allow all authenticated users to view contractors

CREATE POLICY "Users can create contractors" 
ON public.contractors FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update contractors" 
ON public.contractors FOR UPDATE 
USING (auth.uid() = user_id OR is_system_admin());

-- Create RLS policies for contractor_resumes
CREATE POLICY "Users can view contractor resumes" 
ON public.contractor_resumes FOR SELECT 
USING (true);

CREATE POLICY "Users can upload contractor resumes" 
ON public.contractor_resumes FOR INSERT 
WITH CHECK (auth.uid() = uploaded_by);

-- Create RLS policies for contractor_competencies
CREATE POLICY "Users can view contractor competencies" 
ON public.contractor_competencies FOR SELECT 
USING (true);

CREATE POLICY "System can manage contractor competencies" 
ON public.contractor_competencies FOR ALL 
USING (true);

-- Create RLS policies for contractor_experience
CREATE POLICY "Users can view contractor experience" 
ON public.contractor_experience FOR SELECT 
USING (true);

CREATE POLICY "System can manage contractor experience" 
ON public.contractor_experience FOR ALL 
USING (true);

-- Create RLS policies for contractor_recommendations
CREATE POLICY "Users can view contractor recommendations" 
ON public.contractor_recommendations FOR SELECT 
USING (true);

CREATE POLICY "System can manage contractor recommendations" 
ON public.contractor_recommendations FOR ALL 
USING (true);

-- Create RLS policies for contractor_notes
CREATE POLICY "Users can view contractor notes" 
ON public.contractor_notes FOR SELECT 
USING (true);

CREATE POLICY "Users can create contractor notes" 
ON public.contractor_notes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contractor notes" 
ON public.contractor_notes FOR UPDATE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_contractors_trade ON public.contractors(trade);
CREATE INDEX idx_contractors_status ON public.contractors(status);
CREATE INDEX idx_contractors_overall_score ON public.contractors(overall_score);
CREATE INDEX idx_contractors_location ON public.contractors(location);
CREATE INDEX idx_contractor_competencies_contractor_id ON public.contractor_competencies(contractor_id);
CREATE INDEX idx_contractor_competencies_type ON public.contractor_competencies(competency_type);
CREATE INDEX idx_contractor_resumes_contractor_id ON public.contractor_resumes(contractor_id);
CREATE INDEX idx_contractor_experience_contractor_id ON public.contractor_experience(contractor_id);
CREATE INDEX idx_contractor_recommendations_contractor_id ON public.contractor_recommendations(contractor_id);
CREATE INDEX idx_contractor_notes_contractor_id ON public.contractor_notes(contractor_id);

-- Create trigger for updated_at
CREATE TRIGGER update_contractors_updated_at
  BEFORE UPDATE ON public.contractors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for contractor documents
INSERT INTO storage.buckets (id, name, public) VALUES ('contractor-documents', 'contractor-documents', false);

-- Create storage policies for contractor documents
CREATE POLICY "Users can view contractor documents" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'contractor-documents');

CREATE POLICY "Users can upload contractor documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'contractor-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update contractor documents" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'contractor-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete contractor documents" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'contractor-documents' AND auth.uid() IS NOT NULL);