-- Update existing complaint to use new category structure
UPDATE complaints 
SET 
  category = 'Staff Attitude & Behaviour',
  subcategory = 'Rude Behaviour'
WHERE category = 'staff_attitude';