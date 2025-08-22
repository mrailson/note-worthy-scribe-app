-- Create table to store clinical verification batch test results
CREATE TABLE IF NOT EXISTS public.clinical_verification_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL,
  test_results JSONB NOT NULL,
  total_tests INTEGER NOT NULL,
  completed_tests INTEGER NOT NULL,
  failed_tests INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinical_verification_tests ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view test results
CREATE POLICY "Users can view clinical verification tests" 
ON public.clinical_verification_tests 
FOR SELECT 
USING (true);

-- Create policy for authenticated users to insert test results
CREATE POLICY "Authenticated users can insert test results" 
ON public.clinical_verification_tests 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_clinical_verification_tests_updated_at
BEFORE UPDATE ON public.clinical_verification_tests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_clinical_verification_tests_batch_id ON public.clinical_verification_tests(batch_id);
CREATE INDEX idx_clinical_verification_tests_created_at ON public.clinical_verification_tests(created_at DESC);