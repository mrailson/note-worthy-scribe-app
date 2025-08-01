-- Fix security warnings by properly dropping triggers first, then functions
DROP TRIGGER IF EXISTS trigger_update_status_on_acknowledgement ON public.complaint_acknowledgements;
DROP TRIGGER IF EXISTS trigger_update_status_on_outcome ON public.complaint_outcomes;
DROP FUNCTION IF EXISTS update_complaint_status_on_acknowledgement();
DROP FUNCTION IF EXISTS update_complaint_status_on_outcome();

-- Create trigger to update complaint status when acknowledgement is created
CREATE OR REPLACE FUNCTION update_complaint_status_on_acknowledgement()
RETURNS TRIGGER AS $$
BEGIN
  -- Update complaint status to under_review when acknowledgement is created
  UPDATE public.complaints 
  SET 
    status = 'under_review',
    acknowledged_at = COALESCE(acknowledged_at, NEW.created_at)
  WHERE id = NEW.complaint_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp';

CREATE TRIGGER trigger_update_status_on_acknowledgement
  AFTER INSERT ON public.complaint_acknowledgements
  FOR EACH ROW
  EXECUTE FUNCTION update_complaint_status_on_acknowledgement();

-- Create trigger to update complaint status when outcome is created
CREATE OR REPLACE FUNCTION update_complaint_status_on_outcome()
RETURNS TRIGGER AS $$
BEGIN
  -- Update complaint status to resolved when outcome is created
  UPDATE public.complaints 
  SET 
    status = 'resolved',
    closed_at = COALESCE(closed_at, NEW.created_at)
  WHERE id = NEW.complaint_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp';

CREATE TRIGGER trigger_update_status_on_outcome
  AFTER INSERT ON public.complaint_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_complaint_status_on_outcome();