-- Create staff_responses table for storing staff feedback on complaints
CREATE TABLE public.staff_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  staff_email TEXT NOT NULL,
  staff_role TEXT,
  response_text TEXT NOT NULL,
  responded_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.staff_responses ENABLE ROW LEVEL SECURITY;

-- Create policies for staff responses
CREATE POLICY "Users can view staff responses for complaints they have access to" 
ON public.staff_responses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.complaints 
    WHERE complaints.id = staff_responses.complaint_id
  )
);

CREATE POLICY "Authenticated users can create staff responses" 
ON public.staff_responses 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update their own responses" 
ON public.staff_responses 
FOR UPDATE 
USING (
  auth.uid() = responded_by OR 
  auth.email() = staff_email
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_staff_responses_updated_at
BEFORE UPDATE ON public.staff_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_staff_responses_complaint_id ON public.staff_responses(complaint_id);
CREATE INDEX idx_staff_responses_staff_email ON public.staff_responses(staff_email);
CREATE INDEX idx_staff_responses_responded_at ON public.staff_responses(responded_at);