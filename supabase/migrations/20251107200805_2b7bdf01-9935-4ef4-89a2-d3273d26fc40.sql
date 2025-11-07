-- Create function to auto-complete compliance when complaint is closed
CREATE OR REPLACE FUNCTION auto_complete_compliance_on_close()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'closed', mark all compliance items as completed
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    UPDATE complaint_compliance
    SET 
      is_completed = true,
      completed_at = CASE 
        WHEN completed_at IS NULL THEN now()
        ELSE completed_at
      END,
      updated_at = now()
    WHERE complaint_id = NEW.id
    AND is_completed = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on complaints table
DROP TRIGGER IF EXISTS auto_complete_compliance_trigger ON complaints;
CREATE TRIGGER auto_complete_compliance_trigger
  AFTER UPDATE OF status ON complaints
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_compliance_on_close();