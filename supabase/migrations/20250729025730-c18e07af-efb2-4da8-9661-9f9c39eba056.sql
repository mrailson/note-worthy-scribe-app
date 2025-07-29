-- Create table for bank holidays and closed days
CREATE TABLE public.bank_holidays_closed_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank_holiday', 'closed_day', 'replacement_shift')),
  is_replacement_required BOOLEAN NOT NULL DEFAULT false,
  hours_to_replace DECIMAL(4,2) DEFAULT NULL,
  replacement_deadline DATE DEFAULT NULL,
  replacement_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.bank_holidays_closed_days ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view bank holidays" 
ON public.bank_holidays_closed_days 
FOR SELECT 
USING (true);

CREATE POLICY "System admins can manage bank holidays" 
ON public.bank_holidays_closed_days 
FOR ALL 
USING (is_system_admin());

-- Create table for replacement shifts
CREATE TABLE public.replacement_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_holiday_id UUID NOT NULL REFERENCES public.bank_holidays_closed_days(id) ON DELETE CASCADE,
  shift_template_id UUID REFERENCES public.shift_templates(id),
  assignment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  hours DECIMAL(4,2) NOT NULL,
  location TEXT NOT NULL,
  required_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'assigned', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES public.staff_members(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Enable RLS on replacement shifts
ALTER TABLE public.replacement_shifts ENABLE ROW LEVEL SECURITY;

-- Create policies for replacement shifts
CREATE POLICY "Authenticated users can view replacement shifts" 
ON public.replacement_shifts 
FOR SELECT 
USING (true);

CREATE POLICY "System admins can manage replacement shifts" 
ON public.replacement_shifts 
FOR ALL 
USING (is_system_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_bank_holidays_closed_days_updated_at
  BEFORE UPDATE ON public.bank_holidays_closed_days
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_replacement_shifts_updated_at
  BEFORE UPDATE ON public.replacement_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert UK Bank Holidays for 2024-2026 (excluding Sundays)
INSERT INTO public.bank_holidays_closed_days (date, name, type, is_replacement_required, hours_to_replace, replacement_deadline) VALUES
-- 2024
('2024-01-01', 'New Year''s Day', 'bank_holiday', true, 1.5, '2024-01-15'),
('2024-03-29', 'Good Friday', 'bank_holiday', true, 1.5, '2024-04-12'),
('2024-04-01', 'Easter Monday', 'bank_holiday', true, 1.5, '2024-04-15'),
('2024-05-06', 'Early May Bank Holiday', 'bank_holiday', true, 1.5, '2024-05-20'),
('2024-05-27', 'Spring Bank Holiday', 'bank_holiday', true, 1.5, '2024-06-10'),
('2024-08-26', 'Summer Bank Holiday', 'bank_holiday', true, 1.5, '2024-09-09'),
('2024-12-25', 'Christmas Day', 'bank_holiday', true, 1.5, '2025-01-08'),
('2024-12-26', 'Boxing Day', 'bank_holiday', true, 1.5, '2025-01-09'),

-- 2025
('2025-01-01', 'New Year''s Day', 'bank_holiday', true, 1.5, '2025-01-15'),
('2025-04-18', 'Good Friday', 'bank_holiday', true, 1.5, '2025-05-02'),
('2025-04-21', 'Easter Monday', 'bank_holiday', true, 1.5, '2025-05-05'),
('2025-05-05', 'Early May Bank Holiday', 'bank_holiday', true, 1.5, '2025-05-19'),
('2025-05-26', 'Spring Bank Holiday', 'bank_holiday', true, 1.5, '2025-06-09'),
('2025-08-25', 'Summer Bank Holiday', 'bank_holiday', true, 1.5, '2025-09-08'),
('2025-12-25', 'Christmas Day', 'bank_holiday', true, 1.5, '2026-01-08'),
('2025-12-26', 'Boxing Day', 'bank_holiday', true, 1.5, '2026-01-09'),

-- 2026  
('2026-01-01', 'New Year''s Day', 'bank_holiday', true, 1.5, '2026-01-15'),
('2026-04-03', 'Good Friday', 'bank_holiday', true, 1.5, '2026-04-17'),
('2026-04-06', 'Easter Monday', 'bank_holiday', true, 1.5, '2026-04-20'),
('2026-05-04', 'Early May Bank Holiday', 'bank_holiday', true, 1.5, '2026-05-18'),
('2026-05-25', 'Spring Bank Holiday', 'bank_holiday', true, 1.5, '2026-06-08'),
('2026-08-31', 'Summer Bank Holiday', 'bank_holiday', true, 1.5, '2026-09-14'),
('2026-12-25', 'Christmas Day', 'bank_holiday', true, 1.5, '2027-01-08'),

-- Saturday bank holidays that need 8 hours replacement
('2024-12-28', 'Christmas Day substitute (Saturday)', 'bank_holiday', true, 8.0, '2025-01-11')
ON CONFLICT (date) DO NOTHING;