
INSERT INTO public.nres_buyback_staff (user_id, staff_name, staff_role, allocation_type, allocation_value, hourly_rate, is_active, staff_category, practice_key, start_date)
VALUES
-- === THE PARKS ===
-- GP Locums
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr James Hartley', 'GP Locum', 'sessions', 4, 375, true, 'gp_locum', 'parks', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Priya Sharma', 'GP Locum', 'daily', 2, 750, true, 'gp_locum', 'parks', '2026-01-06'),
-- New SDA
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Sarah Mitchell', 'Advanced Nurse Practitioner', 'sessions', 6, 0, true, 'new_sda', 'parks', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Tom Bradley', 'Clinical Pharmacist', 'wte', 0.6, 0, true, 'new_sda', 'parks', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Aisha Begum', 'Physician Associate', 'hours', 20, 0, true, 'new_sda', 'parks', '2026-01-06'),
-- Buy-Back
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Helen Cross', 'Salaried GP', 'sessions', 3, 0, true, 'buyback', 'parks', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Karen Booth', 'Practice Nurse', 'hours', 12, 28, true, 'buyback', 'parks', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Lisa Greenwood', 'Healthcare Assistant', 'hours', 15, 18, true, 'buyback', 'parks', '2026-01-06'),

-- === BRACKLEY ===
-- GP Locums
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Liam O''Brien', 'GP Locum', 'sessions', 3, 375, true, 'gp_locum', 'brackley', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Fatima Khan', 'GP Locum', 'daily', 1, 750, true, 'gp_locum', 'brackley', '2026-01-06'),
-- New SDA
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Emma Richardson', 'Paramedic Practitioner', 'sessions', 5, 0, true, 'new_sda', 'brackley', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'David Thornton', 'Mental Health Practitioner', 'wte', 0.4, 0, true, 'new_sda', 'brackley', '2026-01-06'),
-- Buy-Back
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Michael Parsons', 'Salaried GP', 'sessions', 4, 0, true, 'buyback', 'brackley', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Angela Foster', 'Practice Nurse', 'hours', 10, 30, true, 'buyback', 'brackley', '2026-01-06'),

-- === SPRINGFIELD ===
-- GP Locums
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr George Whitfield', 'GP Locum', 'sessions', 5, 375, true, 'gp_locum', 'springfield', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Ananya Patel', 'GP Locum', 'daily', 3, 750, true, 'gp_locum', 'springfield', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Robert Jennings', 'GP Locum', 'sessions', 2, 375, true, 'gp_locum', 'springfield', '2026-01-06'),
-- New SDA
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Rachel Hughes', 'Dietitian', 'wte', 0.5, 0, true, 'new_sda', 'springfield', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'James Okonkwo', 'Social Prescriber', 'hours', 16, 0, true, 'new_sda', 'springfield', '2026-01-06'),
-- Buy-Back
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Susan Whitmore', 'Salaried GP', 'sessions', 2, 0, true, 'buyback', 'springfield', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Claire Robinson', 'Practice Nurse', 'hours', 8, 26, true, 'buyback', 'springfield', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Deborah Watts', 'Healthcare Assistant', 'hours', 20, 16, true, 'buyback', 'springfield', '2026-01-06'),

-- === TOWCESTER ===
-- GP Locums
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Mei-Lin Chen', 'GP Locum', 'daily', 2, 750, true, 'gp_locum', 'towcester', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Thomas Ashworth', 'GP Locum', 'sessions', 3, 375, true, 'gp_locum', 'towcester', '2026-01-06'),
-- New SDA
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Natalie Cooper', 'Advanced Nurse Practitioner', 'sessions', 4, 0, true, 'new_sda', 'towcester', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Hassan Ali', 'Clinical Pharmacist', 'wte', 0.8, 0, true, 'new_sda', 'towcester', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Jenny Woodward', 'Physiotherapist', 'hours', 12, 0, true, 'new_sda', 'towcester', '2026-01-06'),
-- Buy-Back
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Catherine Lloyd', 'Salaried GP', 'sessions', 5, 0, true, 'buyback', 'towcester', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Tracey Hammond', 'Practice Nurse', 'hours', 14, 29, true, 'buyback', 'towcester', '2026-01-06'),

-- === BUGBROOKE ===
-- GP Locums
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Sobia Hussain', 'GP Locum', 'sessions', 4, 375, true, 'gp_locum', 'bugbrooke', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr William Denton', 'GP Locum', 'daily', 1, 750, true, 'gp_locum', 'bugbrooke', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Kavita Rao', 'GP Locum', 'sessions', 2, 375, true, 'gp_locum', 'bugbrooke', '2026-01-06'),
-- New SDA
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Peter Langley', 'Paramedic Practitioner', 'sessions', 6, 0, true, 'new_sda', 'bugbrooke', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Samira Yusuf', 'Physician Associate', 'wte', 0.5, 0, true, 'new_sda', 'bugbrooke', '2026-01-06'),
-- Buy-Back
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Richard Barlow', 'Salaried GP', 'sessions', 3, 0, true, 'buyback', 'bugbrooke', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Julie Henderson', 'Practice Nurse', 'hours', 16, 27, true, 'buyback', 'bugbrooke', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Sandra Griffiths', 'Healthcare Assistant', 'hours', 10, 17, true, 'buyback', 'bugbrooke', '2026-01-06'),

-- === BROOK ===
-- GP Locums
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Andrew Blackwell', 'GP Locum', 'daily', 2, 750, true, 'gp_locum', 'brook', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Nadia Khoury', 'GP Locum', 'sessions', 3, 375, true, 'gp_locum', 'brook', '2026-01-06'),
-- New SDA
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Charlotte Evans', 'Mental Health Practitioner', 'wte', 0.6, 0, true, 'new_sda', 'brook', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Andrew Mason', 'Social Prescriber', 'sessions', 4, 0, true, 'new_sda', 'brook', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Rebecca Taylor', 'Clinical Pharmacist', 'hours', 18, 0, true, 'new_sda', 'brook', '2026-01-06'),
-- Buy-Back
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Patrick Connolly', 'Salaried GP', 'sessions', 4, 0, true, 'buyback', 'brook', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Wendy Marshall', 'Practice Nurse', 'hours', 12, 28, true, 'buyback', 'brook', '2026-01-06'),

-- === DENTON ===
-- GP Locums
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Christopher Hale', 'GP Locum', 'sessions', 2, 375, true, 'gp_locum', 'denton', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Amara Osei', 'GP Locum', 'daily', 1, 750, true, 'gp_locum', 'denton', '2026-01-06'),
-- New SDA
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Daniel Price', 'Dietitian', 'wte', 0.3, 0, true, 'new_sda', 'denton', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Laura Bennett', 'Advanced Nurse Practitioner', 'sessions', 3, 0, true, 'new_sda', 'denton', '2026-01-06'),
-- Buy-Back
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Dr Eleanor Shaw', 'Salaried GP', 'sessions', 2, 0, true, 'buyback', 'denton', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Margaret Collins', 'Practice Nurse', 'hours', 8, 25, true, 'buyback', 'denton', '2026-01-06'),
('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Paul Chambers', 'Healthcare Assistant', 'hours', 12, 16, true, 'buyback', 'denton', '2026-01-06');
