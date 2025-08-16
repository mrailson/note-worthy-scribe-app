-- Create sample data with correct enum casting
INSERT INTO public.staff_members (name, email, role, hourly_rate, is_active) 
SELECT name, email, role::staff_role, hourly_rate, is_active FROM (VALUES
    ('Dr. Sarah Johnson', 'sarah.johnson@practice.nhs.uk', 'gp', 85.00, true),
    ('Dr. Michael Brown', 'michael.brown@practice.nhs.uk', 'gp', 80.00, true),
    ('Jane Smith', 'jane.smith@practice.nhs.uk', 'phlebotomist', 25.00, true),
    ('Mark Wilson', 'mark.wilson@practice.nhs.uk', 'nurse', 35.00, true),
    ('Lisa Davis', 'lisa.davis@practice.nhs.uk', 'hca', 22.00, true)
) AS v(name, email, role, hourly_rate, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM public.staff_members WHERE email = v.email
);

-- Create sample shift templates with correct enum casting
INSERT INTO public.shift_templates (name, day_of_week, start_time, end_time, required_role, location, is_active) 
SELECT name, day_of_week, start_time, end_time, required_role::staff_role, location::work_location, is_active FROM (VALUES
    ('Monday Morning GP', 1, '08:00:00'::time, '12:00:00'::time, 'gp', 'kings_heath', true),
    ('Monday Afternoon Phlebotomy', 1, '13:00:00'::time, '17:00:00'::time, 'phlebotomist', 'kings_heath', true),
    ('Tuesday Morning GP', 2, '08:00:00'::time, '12:00:00'::time, 'gp', 'various_practices', true),
    ('Tuesday Afternoon Nurse', 2, '13:00:00'::time, '17:00:00'::time, 'nurse', 'kings_heath', true),
    ('Wednesday Morning GP', 3, '08:00:00'::time, '12:00:00'::time, 'gp', 'remote', true),
    ('Wednesday Afternoon HCA', 3, '13:00:00'::time, '17:00:00'::time, 'hca', 'kings_heath', true),
    ('Thursday Morning GP', 4, '08:00:00'::time, '12:00:00'::time, 'gp', 'kings_heath', true),
    ('Friday Morning GP', 5, '08:00:00'::time, '12:00:00'::time, 'gp', 'various_practices', true),
    ('Friday Afternoon Phlebotomy', 5, '13:00:00'::time, '17:00:00'::time, 'phlebotomist', 'kings_heath', true),
    ('Saturday Extended Hours', 6, '08:00:00'::time, '18:00:00'::time, 'gp', 'kings_heath', true)
) AS v(name, day_of_week, start_time, end_time, required_role, location, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM public.shift_templates WHERE name = v.name AND day_of_week = v.day_of_week
);