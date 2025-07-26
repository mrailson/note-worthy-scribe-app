-- Update existing complaints to use new category mapping
UPDATE public.complaints 
SET category = CASE 
    WHEN category = 'clinical_care' THEN 'Clinical Care & Treatment'
    WHEN category = 'staff_attitude' THEN 'Staff Attitude & Behaviour'
    WHEN category = 'appointment_system' THEN 'Appointments & Access'
    WHEN category = 'communication' THEN 'Communication Issues'
    WHEN category = 'facilities' THEN 'Facilities & Environment'
    WHEN category = 'billing' THEN 'Administration'
    WHEN category = 'waiting_times' THEN 'Appointments & Access'
    WHEN category = 'medication' THEN 'Prescriptions'
    WHEN category = 'referrals' THEN 'Test Results & Follow-Up'
    WHEN category = 'other' THEN 'other'
    ELSE category -- Keep existing if already in new format
END
WHERE category IN ('clinical_care', 'staff_attitude', 'appointment_system', 'communication', 'facilities', 'billing', 'waiting_times', 'medication', 'referrals', 'other');