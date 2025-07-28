-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.update_staff_hours_summary()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
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
$$;