-- Update existing complaints to use new category system
UPDATE complaints 
SET 
  category = 'Staff Attitude & Behaviour',
  subcategory = 'Rude Behaviour'
WHERE category = 'staff_attitude';

-- Update other old categories if they exist
UPDATE complaints SET category = 'Appointments & Access' WHERE category = 'booking_issues';
UPDATE complaints SET category = 'Clinical Care & Treatment' WHERE category = 'clinical_care';
UPDATE complaints SET category = 'Communication Issues' WHERE category = 'communication';
UPDATE complaints SET category = 'Prescriptions' WHERE category = 'prescriptions';
UPDATE complaints SET category = 'Test Results & Follow-Up' WHERE category = 'test_results';
UPDATE complaints SET category = 'Administration' WHERE category = 'administration';
UPDATE complaints SET category = 'Facilities & Environment' WHERE category = 'facilities';
UPDATE complaints SET category = 'Digital Services' WHERE category = 'digital_services';
UPDATE complaints SET category = 'Confidentiality & Data' WHERE category = 'confidentiality';