-- Update trigger to use correct status 'closed' instead of 'resolved'
DROP TRIGGER IF EXISTS trigger_update_status_on_outcome ON public.complaint_outcomes;
DROP FUNCTION IF EXISTS update_complaint_status_on_outcome();

-- Create trigger to update complaint status when outcome is created
CREATE OR REPLACE FUNCTION update_complaint_status_on_outcome()
RETURNS TRIGGER AS $$
BEGIN
  -- Update complaint status to closed when outcome is created
  UPDATE public.complaints 
  SET 
    status = 'closed',
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