-- Create table for storing medical term corrections
CREATE TABLE public.medical_term_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID,
  incorrect_term TEXT NOT NULL,
  correct_term TEXT NOT NULL,
  context_phrase TEXT,
  usage_count INTEGER DEFAULT 0,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_name TEXT,
  UNIQUE(user_id, incorrect_term, correct_term)
);

-- Enable Row Level Security
ALTER TABLE public.medical_term_corrections ENABLE ROW LEVEL SECURITY;

-- Create policies for medical term corrections
CREATE POLICY "Users can view their own corrections" 
ON public.medical_term_corrections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own corrections" 
ON public.medical_term_corrections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own corrections" 
ON public.medical_term_corrections 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own corrections" 
ON public.medical_term_corrections 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_medical_corrections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_medical_corrections_updated_at
BEFORE UPDATE ON public.medical_term_corrections
FOR EACH ROW
EXECUTE FUNCTION public.update_medical_corrections_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_medical_corrections_user_id ON public.medical_term_corrections(user_id);
CREATE INDEX idx_medical_corrections_incorrect_term ON public.medical_term_corrections(incorrect_term);
CREATE INDEX idx_medical_corrections_global ON public.medical_term_corrections(is_global);

-- Add some common medical term corrections
INSERT INTO public.medical_term_corrections (user_id, incorrect_term, correct_term, is_global, created_by_name) VALUES
(gen_random_uuid(), 'cof', 'QOF', true, 'System'),
(gen_random_uuid(), 'quality outcomes framework', 'QOF', true, 'System'),
(gen_random_uuid(), 'ars', 'ARRS', true, 'System'),
(gen_random_uuid(), 'additional roles reimbursement scheme', 'ARRS', true, 'System'),
(gen_random_uuid(), 'pcn', 'PCN', true, 'System'),
(gen_random_uuid(), 'primary care network', 'PCN', true, 'System'),
(gen_random_uuid(), 'cqc', 'CQC', true, 'System'),
(gen_random_uuid(), 'care quality commission', 'CQC', true, 'System'),
(gen_random_uuid(), 'gms', 'GMS', true, 'System'),
(gen_random_uuid(), 'general medical services', 'GMS', true, 'System'),
(gen_random_uuid(), 'pms', 'PMS', true, 'System'),
(gen_random_uuid(), 'personal medical services', 'PMS', true, 'System'),
(gen_random_uuid(), 'dna', 'DNA', true, 'System'),
(gen_random_uuid(), 'did not attend', 'DNA', true, 'System'),
(gen_random_uuid(), 'nhs', 'NHS', true, 'System'),
(gen_random_uuid(), 'national health service', 'NHS', true, 'System'),
(gen_random_uuid(), 'gp', 'GP', true, 'System'),
(gen_random_uuid(), 'general practitioner', 'GP', true, 'System');