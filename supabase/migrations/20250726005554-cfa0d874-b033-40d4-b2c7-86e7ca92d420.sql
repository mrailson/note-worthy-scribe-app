-- Create complaint_signatures table
CREATE TABLE public.complaint_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  qualifications TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  practice_id UUID,
  signature_text TEXT,
  signature_image_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  use_for_acknowledgements BOOLEAN NOT NULL DEFAULT true,
  use_for_outcome_letters BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.complaint_signatures ENABLE ROW LEVEL SECURITY;

-- Create policies for complaint signatures
CREATE POLICY "Users can create their own signatures" 
ON public.complaint_signatures 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own signatures" 
ON public.complaint_signatures 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own signatures" 
ON public.complaint_signatures 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own signatures" 
ON public.complaint_signatures 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add foreign key constraint to practice_details
ALTER TABLE public.complaint_signatures 
ADD CONSTRAINT complaint_signatures_practice_id_fkey 
FOREIGN KEY (practice_id) REFERENCES public.practice_details(id);

-- Create trigger for updated_at
CREATE TRIGGER update_complaint_signatures_updated_at
BEFORE UPDATE ON public.complaint_signatures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();