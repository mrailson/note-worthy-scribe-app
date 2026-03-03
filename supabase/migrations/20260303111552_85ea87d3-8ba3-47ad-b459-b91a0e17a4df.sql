
-- Backfill NULL practice_id entries from user_roles
UPDATE nres_hours_entries h
SET practice_id = (
  SELECT ur.practice_id 
  FROM user_roles ur 
  WHERE ur.user_id = h.user_id 
    AND ur.practice_id IS NOT NULL 
  LIMIT 1
)
WHERE h.practice_id IS NULL;

-- Same for expenses (future-proofing)
UPDATE nres_expenses e
SET practice_id = (
  SELECT ur.practice_id 
  FROM user_roles ur 
  WHERE ur.user_id = e.user_id 
    AND ur.practice_id IS NOT NULL 
  LIMIT 1
)
WHERE e.practice_id IS NULL;

-- Create trigger to auto-populate practice_id on insert
CREATE OR REPLACE FUNCTION set_nres_practice_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.practice_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT ur.practice_id INTO NEW.practice_id
    FROM user_roles ur
    WHERE ur.user_id = NEW.user_id
      AND ur.practice_id IS NOT NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_nres_hours_practice_id ON nres_hours_entries;
CREATE TRIGGER trg_set_nres_hours_practice_id
  BEFORE INSERT ON nres_hours_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_nres_practice_id();

DROP TRIGGER IF EXISTS trg_set_nres_expenses_practice_id ON nres_expenses;
CREATE TRIGGER trg_set_nres_expenses_practice_id
  BEFORE INSERT ON nres_expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_nres_practice_id();
