-- Create specialist services table for GP referrals
CREATE TABLE public.specialist_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  department TEXT,
  hospital_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  specialty_type TEXT,
  notes TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.specialist_services ENABLE ROW LEVEL SECURITY;

-- Create policies for specialist services
CREATE POLICY "Users can view their own specialist services" 
ON public.specialist_services 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own specialist services" 
ON public.specialist_services 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own specialist services" 
ON public.specialist_services 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own specialist services" 
ON public.specialist_services 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create GP signature settings table
CREATE TABLE public.gp_signature_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  gp_name TEXT NOT NULL,
  qualifications TEXT,
  practice_name TEXT,
  practice_id UUID REFERENCES public.practice_details(id),
  job_title TEXT,
  gmc_number TEXT,
  is_default BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gp_signature_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for GP signature settings
CREATE POLICY "Users can view their own GP signature settings" 
ON public.gp_signature_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own GP signature settings" 
ON public.gp_signature_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own GP signature settings" 
ON public.gp_signature_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own GP signature settings" 
ON public.gp_signature_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_specialist_services_updated_at
BEFORE UPDATE ON public.specialist_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gp_signature_settings_updated_at
BEFORE UPDATE ON public.gp_signature_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();