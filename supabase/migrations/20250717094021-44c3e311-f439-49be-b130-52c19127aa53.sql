-- Create attendees table for managing meeting attendees
CREATE TABLE public.attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  title TEXT, -- Dr, Mr, Mrs, Ms, etc.
  organization TEXT,
  role TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;

-- Create policies for attendees
CREATE POLICY "Users can view their own attendees" 
ON public.attendees 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own attendees" 
ON public.attendees 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own attendees" 
ON public.attendees 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own attendees" 
ON public.attendees 
FOR DELETE 
USING (user_id = auth.uid());

-- Create practice_details table for managing user's practice information
CREATE TABLE public.practice_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  practice_name TEXT NOT NULL,
  address TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  pcn_code TEXT,
  is_default BOOLEAN DEFAULT false,
  use_for_all_meetings BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.practice_details ENABLE ROW LEVEL SECURITY;

-- Create policies for practice_details
CREATE POLICY "Users can view their own practice details" 
ON public.practice_details 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own practice details" 
ON public.practice_details 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own practice details" 
ON public.practice_details 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own practice details" 
ON public.practice_details 
FOR DELETE 
USING (user_id = auth.uid());

-- Create trigger for automatic timestamp updates on attendees
CREATE TRIGGER update_attendees_updated_at
BEFORE UPDATE ON public.attendees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on practice_details
CREATE TRIGGER update_practice_details_updated_at
BEFORE UPDATE ON public.practice_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();