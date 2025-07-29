-- Update Monday to Friday shift templates to be 2 hours instead of 1.5 hours
-- Change end time from 20:00 to 20:30 for weekday shifts
UPDATE shift_templates 
SET end_time = '20:30:00'
WHERE day_of_week BETWEEN 1 AND 5  -- Monday (1) to Friday (5)
  AND start_time = '18:30:00'      -- Only update shifts that start at 6:30pm
  AND end_time = '20:00:00';       -- Only update shifts that currently end at 8:00pm

-- Also update any existing staff assignments for these shifts to reflect the new end time
UPDATE staff_assignments 
SET end_time = '20:30:00'
WHERE shift_template_id IN (
  SELECT id FROM shift_templates 
  WHERE day_of_week BETWEEN 1 AND 5 
    AND start_time = '18:30:00'
    AND end_time = '20:30:00'  -- Now matches the updated template
)
AND end_time = '20:00:00';  -- Only update assignments that still have the old end time