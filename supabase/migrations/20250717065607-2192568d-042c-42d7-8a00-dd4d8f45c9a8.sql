-- Create Primary Care Networks table
CREATE TABLE public.primary_care_networks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pcn_code TEXT NOT NULL UNIQUE,
  pcn_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert all Northamptonshire PCNs
INSERT INTO public.primary_care_networks (pcn_code, pcn_name) VALUES
('U52261', 'Blue PCN'),
('U07902', 'Brackley and Towcester PCN'),
('U79464', 'Daventry PCN'),
('U28255', 'East Northants PCN'),
('U09187', 'Grand Union PCN'),
('U35821', 'Kettering and South West Rural PCN'),
('U40159', 'MMWF PCN'),
('U36651', 'M-Web PCN'),
('U96568', 'Northamptonshire Rural PCN'),
('U69252', 'Parkwood PCN'),
('U09772', 'Red Kite Healthcare PCN'),
('U53419', 'Rockingham Forest PCN'),
('U58673', 'Royal Parks PCN'),
('U97651', 'The Arc Hub PCN'),
('U21248', 'Triangle PCN'),
('U19031', 'Wellingborough and District PCN');

-- Enable RLS on PCN table (read-only for authenticated users)
ALTER TABLE public.primary_care_networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PCNs are viewable by authenticated users" 
ON public.primary_care_networks 
FOR SELECT 
TO authenticated
USING (true);