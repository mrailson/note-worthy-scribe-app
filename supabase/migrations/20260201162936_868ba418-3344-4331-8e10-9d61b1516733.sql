-- Create development costs table for tracking Notewell AI development expenses
CREATE TABLE public.development_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cost_date DATE NOT NULL,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('invoice', 'time', 'subscription', 'other')),
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  hours NUMERIC(5,2),
  hourly_rate NUMERIC(10,2),
  vendor TEXT,
  invoice_reference TEXT,
  file_path TEXT,
  file_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.development_costs ENABLE ROW LEVEL SECURITY;

-- Create policies - only system admins can access
CREATE POLICY "System admins can view all development costs"
ON public.development_costs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'system_admin'
  )
);

CREATE POLICY "System admins can insert development costs"
ON public.development_costs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'system_admin'
  )
);

CREATE POLICY "System admins can update development costs"
ON public.development_costs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'system_admin'
  )
);

CREATE POLICY "System admins can delete development costs"
ON public.development_costs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'system_admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_development_costs_updated_at
BEFORE UPDATE ON public.development_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster date-based queries
CREATE INDEX idx_development_costs_date ON public.development_costs(cost_date DESC);
CREATE INDEX idx_development_costs_type ON public.development_costs(cost_type);
CREATE INDEX idx_development_costs_category ON public.development_costs(category);