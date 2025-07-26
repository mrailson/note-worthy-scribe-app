-- First, let's see what enum values currently exist and add the new ones
ALTER TYPE complaint_category ADD VALUE IF NOT EXISTS 'Appointments & Access';
ALTER TYPE complaint_category ADD VALUE IF NOT EXISTS 'Clinical Care & Treatment';
ALTER TYPE complaint_category ADD VALUE IF NOT EXISTS 'Communication Issues';
ALTER TYPE complaint_category ADD VALUE IF NOT EXISTS 'Staff Attitude & Behaviour';
ALTER TYPE complaint_category ADD VALUE IF NOT EXISTS 'Prescriptions';
ALTER TYPE complaint_category ADD VALUE IF NOT EXISTS 'Test Results & Follow-Up';
ALTER TYPE complaint_category ADD VALUE IF NOT EXISTS 'Administration';
ALTER TYPE complaint_category ADD VALUE IF NOT EXISTS 'Facilities & Environment';
ALTER TYPE complaint_category ADD VALUE IF NOT EXISTS 'Digital Services';
ALTER TYPE complaint_category ADD VALUE IF NOT EXISTS 'Confidentiality & Data';

-- Now update the existing complaint to use the new category
UPDATE complaints 
SET 
  category = 'Staff Attitude & Behaviour',
  subcategory = 'Rude Behaviour'
WHERE category = 'staff_attitude';