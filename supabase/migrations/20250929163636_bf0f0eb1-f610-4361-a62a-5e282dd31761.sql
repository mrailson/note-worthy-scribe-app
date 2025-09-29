-- Add fridge monitoring access to user_roles table
ALTER TABLE public.user_roles ADD COLUMN fridge_monitoring_access boolean NOT NULL DEFAULT false;

-- Create practice_fridges table for fridge management
CREATE TABLE public.practice_fridges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id uuid NOT NULL,
  fridge_name text NOT NULL,
  location text NOT NULL,
  min_temp_celsius numeric(4,2) NOT NULL DEFAULT 2.0,
  max_temp_celsius numeric(4,2) NOT NULL DEFAULT 8.0,
  qr_code_data text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Create fridge_temperature_readings table
CREATE TABLE public.fridge_temperature_readings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fridge_id uuid NOT NULL REFERENCES public.practice_fridges(id) ON DELETE CASCADE,
  temperature_celsius numeric(4,2) NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL,
  notes text,
  is_within_range boolean NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create fridge_temperature_alerts table
CREATE TABLE public.fridge_temperature_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fridge_id uuid NOT NULL REFERENCES public.practice_fridges(id) ON DELETE CASCADE,
  reading_id uuid NOT NULL REFERENCES public.fridge_temperature_readings(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('temperature_out_of_range', 'missed_reading', 'system_alert')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message text NOT NULL,
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.practice_fridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fridge_temperature_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fridge_temperature_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for practice_fridges
CREATE POLICY "Practice users can view their practice fridges" 
ON public.practice_fridges 
FOR SELECT 
USING (practice_id = ANY (get_user_practice_ids()));

CREATE POLICY "Practice managers can manage their practice fridges" 
ON public.practice_fridges 
FOR ALL 
USING (
  practice_id = ANY (get_user_practice_ids()) AND 
  (has_role(auth.uid(), 'practice_manager'::app_role) OR has_role(auth.uid(), 'system_admin'::app_role))
)
WITH CHECK (
  practice_id = ANY (get_user_practice_ids()) AND 
  (has_role(auth.uid(), 'practice_manager'::app_role) OR has_role(auth.uid(), 'system_admin'::app_role))
);

-- RLS policies for fridge_temperature_readings
CREATE POLICY "Practice users can view their practice fridge readings" 
ON public.fridge_temperature_readings 
FOR SELECT 
USING (
  fridge_id IN (
    SELECT id FROM public.practice_fridges 
    WHERE practice_id = ANY (get_user_practice_ids())
  )
);

CREATE POLICY "Users with fridge access can record temperatures" 
ON public.fridge_temperature_readings 
FOR INSERT 
WITH CHECK (
  auth.uid() = recorded_by AND
  fridge_id IN (
    SELECT pf.id FROM public.practice_fridges pf
    JOIN public.user_roles ur ON ur.practice_id = pf.practice_id
    WHERE ur.user_id = auth.uid() AND ur.fridge_monitoring_access = true
  )
);

-- RLS policies for fridge_temperature_alerts
CREATE POLICY "Practice users can view their practice fridge alerts" 
ON public.fridge_temperature_alerts 
FOR SELECT 
USING (
  fridge_id IN (
    SELECT id FROM public.practice_fridges 
    WHERE practice_id = ANY (get_user_practice_ids())
  )
);

CREATE POLICY "Practice managers can manage alerts" 
ON public.fridge_temperature_alerts 
FOR ALL 
USING (
  fridge_id IN (
    SELECT id FROM public.practice_fridges 
    WHERE practice_id = ANY (get_user_practice_ids())
  ) AND 
  (has_role(auth.uid(), 'practice_manager'::app_role) OR has_role(auth.uid(), 'system_admin'::app_role))
);

-- Create function to automatically check temperature range
CREATE OR REPLACE FUNCTION public.check_temperature_range()
RETURNS TRIGGER AS $$
DECLARE
  fridge_record public.practice_fridges%ROWTYPE;
BEGIN
  -- Get the fridge details
  SELECT * INTO fridge_record 
  FROM public.practice_fridges 
  WHERE id = NEW.fridge_id;
  
  -- Check if temperature is within range
  NEW.is_within_range = (
    NEW.temperature_celsius >= fridge_record.min_temp_celsius AND 
    NEW.temperature_celsius <= fridge_record.max_temp_celsius
  );
  
  -- Create alert if out of range
  IF NOT NEW.is_within_range THEN
    INSERT INTO public.fridge_temperature_alerts (
      fridge_id,
      reading_id,
      alert_type,
      severity,
      message
    ) VALUES (
      NEW.fridge_id,
      NEW.id,
      'temperature_out_of_range',
      CASE 
        WHEN NEW.temperature_celsius < fridge_record.min_temp_celsius - 2 OR 
             NEW.temperature_celsius > fridge_record.max_temp_celsius + 2 
        THEN 'critical'
        ELSE 'high'
      END,
      'Temperature ' || NEW.temperature_celsius || '°C is outside acceptable range (' || 
      fridge_record.min_temp_celsius || '°C - ' || fridge_record.max_temp_celsius || '°C)'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for temperature range checking
CREATE TRIGGER check_temperature_range_trigger
  BEFORE INSERT ON public.fridge_temperature_readings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_temperature_range();

-- Create updated_at triggers
CREATE TRIGGER update_practice_fridges_updated_at
  BEFORE UPDATE ON public.practice_fridges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();