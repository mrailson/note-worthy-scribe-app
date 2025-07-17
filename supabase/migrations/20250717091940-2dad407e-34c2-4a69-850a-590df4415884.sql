-- Create table for NHS terms and definitions
CREATE TABLE public.nhs_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  is_master BOOLEAN NOT NULL DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique terms per user (master terms have user_id = null)
  UNIQUE(term, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.nhs_terms ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view master terms and their own terms
CREATE POLICY "Users can view master terms and their own terms" 
ON public.nhs_terms 
FOR SELECT 
USING (is_master = true OR user_id = auth.uid());

-- Policy: Users can create their own terms
CREATE POLICY "Users can create their own terms" 
ON public.nhs_terms 
FOR INSERT 
WITH CHECK (user_id = auth.uid() AND is_master = false);

-- Policy: Users can update their own terms
CREATE POLICY "Users can update their own terms" 
ON public.nhs_terms 
FOR UPDATE 
USING (user_id = auth.uid() AND is_master = false);

-- Policy: Users can delete their own terms
CREATE POLICY "Users can delete their own terms" 
ON public.nhs_terms 
FOR DELETE 
USING (user_id = auth.uid() AND is_master = false);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_nhs_terms_updated_at
BEFORE UPDATE ON public.nhs_terms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some master NHS terms
INSERT INTO public.nhs_terms (term, definition, is_master, user_id) VALUES
('CQC', 'Care Quality Commission - The independent regulator of health and adult social care in England', true, null),
('QoF', 'Quality and Outcomes Framework - A system for the performance management and payment of general practitioners', true, null),
('IIF', 'Investment and Impact Fund - A scheme that replaces QOF to reward practices for delivering high quality care', true, null),
('PCN', 'Primary Care Network - Groups of neighbouring practices working together with community health services', true, null),
('CCG', 'Clinical Commissioning Group - NHS organisations that commission healthcare services for their local area', true, null),
('ICB', 'Integrated Care Board - NHS organisations responsible for planning and buying healthcare services', true, null),
('ARRS', 'Additional Roles Reimbursement Scheme - Funding to recruit additional staff in primary care', true, null),
('DES', 'Directed Enhanced Service - Nationally directed services that all practices must provide', true, null),
('LES', 'Local Enhanced Service - Locally commissioned services specific to local population needs', true, null),
('GPFV', 'General Practice Forward View - NHS strategy for strengthening general practice', true, null),
('STP', 'Sustainability and Transformation Partnership - NHS organisations covering specific geographical areas', true, null),
('MDT', 'Multi-Disciplinary Team - A group of healthcare professionals from different specialties', true, null),
('EMIS', 'Egton Medical Information Systems - Electronic health record system used in UK primary care', true, null),
('TPP', 'The Phoenix Partnership - Provider of SystmOne clinical information system', true, null),
('SNOMED CT', 'Systematized Nomenclature of Medicine Clinical Terms - International healthcare terminology standard', true, null);