-- Create neighbourhoods table for organizing GP practices
CREATE TABLE public.neighbourhoods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on neighbourhoods table
ALTER TABLE public.neighbourhoods ENABLE ROW LEVEL SECURITY;

-- Create policies for neighbourhoods
CREATE POLICY "Authenticated users can view neighbourhoods"
ON public.neighbourhoods
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System admins can manage neighbourhoods"
ON public.neighbourhoods
FOR ALL
TO authenticated
USING (is_system_admin());

-- Add neighbourhood_id to gp_practices table
ALTER TABLE public.gp_practices 
ADD COLUMN neighbourhood_id UUID REFERENCES public.neighbourhoods(id);

-- Create trigger for updating updated_at timestamp
CREATE TRIGGER update_neighbourhoods_updated_at
BEFORE UPDATE ON public.neighbourhoods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_gp_practices_neighbourhood_id ON public.gp_practices(neighbourhood_id);
CREATE INDEX idx_neighbourhoods_name ON public.neighbourhoods(name);