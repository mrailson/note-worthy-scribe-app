-- Create a function to automatically set status to 'closed' when closed_at is set
CREATE OR REPLACE FUNCTION auto_update_complaint_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If closed_at is being set and status is not 'closed', update it
  IF NEW.closed_at IS NOT NULL AND NEW.status != 'closed' THEN
    NEW.status = 'closed';
  END IF;
  
  -- If closed_at is being cleared, ensure status is not 'closed'
  IF NEW.closed_at IS NULL AND NEW.status = 'closed' THEN
    NEW.status = 'under_review';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically manage complaint status
DROP TRIGGER IF EXISTS trigger_auto_update_complaint_status ON complaints;
CREATE TRIGGER trigger_auto_update_complaint_status
  BEFORE INSERT OR UPDATE ON complaints
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_complaint_status();

-- Create RPC function to fix existing complaints with inconsistent status
CREATE OR REPLACE FUNCTION fix_complaint_status_inconsistencies()
RETURNS TABLE (
  reference_number text,
  old_status text,
  new_status text
) AS $$
BEGIN
  RETURN QUERY
  UPDATE complaints
  SET 
    status = 'closed',
    updated_at = NOW()
  WHERE closed_at IS NOT NULL AND status != 'closed'
  RETURNING complaints.reference_number, 'under_review'::text AS old_status, 'closed'::text AS new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix COMP250036 and any other affected complaints immediately
UPDATE complaints
SET 
  status = 'closed',
  updated_at = NOW()
WHERE closed_at IS NOT NULL AND status != 'closed';