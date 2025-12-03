-- Batch 83-88: Mental health and Psychiatric
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description) VALUES
-- Mental health additional
('191736004', 'Obsessive compulsive disorder', 'Mental Health'),
('197480006', 'Post-traumatic stress disorder', 'Mental Health'),
('17226007', 'Adjustment disorder', 'Mental Health'),
('197528001', 'Borderline personality disorder', 'Mental Health'),
('68890003', 'Schizoaffective disorder', 'Mental Health'),
('191667009', 'Paranoid schizophrenia', 'Mental Health'),
('191527001', 'Acute psychotic episode', 'Mental Health'),
('3415004', 'Catatonia', 'Mental Health'),
('231504006', 'Mixed anxiety and depressive disorder', 'Mental Health'),
('191659001', 'Atypical depressive disorder', 'Mental Health'),
('87512008', 'Mild depressive episode', 'Mental Health'),
('310495003', 'Moderate depressive episode', 'Mental Health'),
('310496002', 'Severe depressive episode without psychosis', 'Mental Health'),
('310497006', 'Severe depressive episode with psychosis', 'Mental Health'),
('78667006', 'Dysthymia', 'Mental Health'),
-- Eating disorders
('56882008', 'Anorexia nervosa', 'Mental Health'),
('78004001', 'Bulimia nervosa', 'Mental Health'),
('72366004', 'Eating disorder', 'Mental Health'),
('439960005', 'Binge eating disorder', 'Mental Health'),
-- Neurodevelopmental
('35919005', 'Autism spectrum disorder', 'Neurodevelopmental'),
('408856003', 'Asperger syndrome', 'Neurodevelopmental'),
('406506008', 'Attention deficit hyperactivity disorder', 'Neurodevelopmental'),
('59770006', 'Dyslexia', 'Neurodevelopmental'),
('229746007', 'Dyspraxia', 'Neurodevelopmental'),
('87715008', 'Intellectual disability', 'Neurodevelopmental')
ON CONFLICT (snomed_code) DO NOTHING;