-- Fix the auto-complete compliance trigger with correct table and column names
CREATE OR REPLACE FUNCTION auto_complete_compliance_on_close()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'closed', mark all compliance checks as compliant
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    UPDATE complaint_compliance_checks
    SET 
      is_compliant = true,
      checked_at = CASE 
        WHEN checked_at IS NULL THEN now()
        ELSE checked_at
      END,
      checked_by = CASE 
        WHEN checked_by IS NULL THEN auth.uid()
        ELSE checked_by
      END
    WHERE complaint_id = NEW.id
    AND is_compliant = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;