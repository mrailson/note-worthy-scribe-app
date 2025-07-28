-- Create staff management tables for Enhanced Access Services

-- Staff roles enum
CREATE TYPE staff_role AS ENUM ('gp', 'phlebotomist', 'hca', 'nurse', 'paramedic', 'receptionist');

-- Work location enum  
CREATE TYPE work_location AS ENUM ('remote', 'kings_heath', 'various_practices');

-- Staff members table
CREATE TABLE public.staff_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role staff_role NOT NULL,
  hourly_rate DECIMAL(8,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Shift templates table (defines recurring shifts)
CREATE TABLE public.shift_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL, -- 1=Monday, 2=Tuesday, etc.
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location work_location NOT NULL,
  required_role staff_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_day_of_week CHECK (day_of_week >= 1 AND day_of_week <= 7)
);

-- Staff assignments table (actual assignments to shifts)
CREATE TABLE public.staff_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_template_id UUID REFERENCES public.shift_templates(id) ON DELETE CASCADE,
  staff_member_id UUID REFERENCES public.staff_members(id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location work_location NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
  hours_worked DECIMAL(4,2),
  notes TEXT,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shift_template_id, assignment_date)
);

-- Hours tracking summary table (for quick reporting)
CREATE TABLE public.staff_hours_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_member_id UUID REFERENCES public.staff_members(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  total_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  total_shifts INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(staff_member_id, year, month, week_number)
);

-- Enable RLS
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_hours_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view staff members" 
ON public.staff_members FOR SELECT 
USING (true);

CREATE POLICY "Practice managers can manage staff members" 
ON public.staff_members FOR ALL 
USING (has_role(auth.uid(), 'practice_manager'::app_role) OR is_system_admin());

CREATE POLICY "Authenticated users can view shift templates" 
ON public.shift_templates FOR SELECT 
USING (true);

CREATE POLICY "Practice managers can manage shift templates" 
ON public.shift_templates FOR ALL 
USING (has_role(auth.uid(), 'practice_manager'::app_role) OR is_system_admin());

CREATE POLICY "Authenticated users can view staff assignments" 
ON public.staff_assignments FOR SELECT 
USING (true);

CREATE POLICY "Practice managers can manage staff assignments" 
ON public.staff_assignments FOR ALL 
USING (has_role(auth.uid(), 'practice_manager'::app_role) OR is_system_admin());

CREATE POLICY "Authenticated users can view hours summary" 
ON public.staff_hours_summary FOR SELECT 
USING (true);

CREATE POLICY "System can manage hours summary" 
ON public.staff_hours_summary FOR ALL 
USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_staff_members_updated_at
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shift_templates_updated_at
  BEFORE UPDATE ON public.shift_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_assignments_updated_at
  BEFORE UPDATE ON public.staff_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default shift templates
INSERT INTO public.shift_templates (name, day_of_week, start_time, end_time, location, required_role) VALUES
-- Weekday GP shifts (remote by default)
('Monday Evening GP', 1, '18:30', '20:00', 'remote', 'gp'),
('Tuesday Evening GP', 2, '18:30', '20:00', 'remote', 'gp'),
('Wednesday Evening GP', 3, '18:30', '20:00', 'remote', 'gp'),
('Thursday Evening GP', 4, '18:30', '20:00', 'remote', 'gp'),
('Friday Evening GP', 5, '18:30', '20:00', 'remote', 'gp'),

-- Saturday shifts at Kings Heath
('Saturday GP', 6, '09:00', '17:00', 'kings_heath', 'gp'),
('Saturday Phlebotomist', 6, '09:00', '17:00', 'kings_heath', 'phlebotomist'),
('Saturday Receptionist', 6, '09:00', '17:00', 'kings_heath', 'receptionist');

-- Function to update hours summary when assignments change
CREATE OR REPLACE FUNCTION public.update_staff_hours_summary()
RETURNS TRIGGER AS $$
DECLARE
  assignment_week INTEGER;
  assignment_year INTEGER;
  assignment_month INTEGER;
  calculated_hours DECIMAL(4,2);
BEGIN
  -- Calculate which record to update
  IF TG_OP = 'DELETE' THEN
    assignment_week := EXTRACT(WEEK FROM OLD.assignment_date);
    assignment_year := EXTRACT(YEAR FROM OLD.assignment_date);
    assignment_month := EXTRACT(MONTH FROM OLD.assignment_date);
    
    -- Remove hours from summary
    INSERT INTO public.staff_hours_summary 
      (staff_member_id, year, month, week_number, total_hours, total_shifts)
    VALUES 
      (OLD.staff_member_id, assignment_year, assignment_month, assignment_week, 
       -(COALESCE(OLD.hours_worked, EXTRACT(EPOCH FROM (OLD.end_time - OLD.start_time))/3600)), -1)
    ON CONFLICT (staff_member_id, year, month, week_number)
    DO UPDATE SET
      total_hours = staff_hours_summary.total_hours - EXCLUDED.total_hours,
      total_shifts = staff_hours_summary.total_shifts - EXCLUDED.total_shifts,
      updated_at = now();
      
    RETURN OLD;
  ELSE
    assignment_week := EXTRACT(WEEK FROM NEW.assignment_date);
    assignment_year := EXTRACT(YEAR FROM NEW.assignment_date);
    assignment_month := EXTRACT(MONTH FROM NEW.assignment_date);
    
    -- Calculate hours (use hours_worked if available, otherwise calculate from times)
    calculated_hours := COALESCE(NEW.hours_worked, EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))/3600);
    
    -- Update summary
    INSERT INTO public.staff_hours_summary 
      (staff_member_id, year, month, week_number, total_hours, total_shifts)
    VALUES 
      (NEW.staff_member_id, assignment_year, assignment_month, assignment_week, calculated_hours, 1)
    ON CONFLICT (staff_member_id, year, month, week_number)
    DO UPDATE SET
      total_hours = staff_hours_summary.total_hours + EXCLUDED.total_hours,
      total_shifts = staff_hours_summary.total_shifts + EXCLUDED.total_shifts,
      updated_at = now();
      
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for hours summary updates
CREATE TRIGGER update_hours_summary_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_staff_hours_summary();