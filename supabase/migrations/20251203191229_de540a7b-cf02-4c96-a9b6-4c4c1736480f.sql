-- Batch 54: Learning disabilities and developmental
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('110359009', 'Intellectual disability', 'diagnoses', 'Learning Disability'),
('408856003', 'Mild learning disability', 'diagnoses', 'Learning Disability'),
('408857007', 'Moderate learning disability', 'diagnoses', 'Learning Disability'),
('408858002', 'Severe learning disability', 'diagnoses', 'Learning Disability'),
('408859005', 'Profound learning disability', 'diagnoses', 'Learning Disability'),
('229746007', 'Dyslexia', 'diagnoses', 'Learning Disability'),
('1855002', 'Dyspraxia', 'diagnoses', 'Learning Disability'),
('59770001', 'Dyscalculia', 'diagnoses', 'Learning Disability'),
('87433001', 'Autism', 'diagnoses', 'Development'),
('373618009', 'Asperger syndrome', 'diagnoses', 'Development'),
('91138005', 'Global developmental delay', 'diagnoses', 'Development'),
('229746007', 'Speech and language delay', 'diagnoses', 'Development'),
('229153001', 'Selective mutism', 'diagnoses', 'Development'),
('229171001', 'Rett syndrome', 'diagnoses', 'Development'),
('35919005', 'Fragile X syndrome', 'diagnoses', 'Development')
ON CONFLICT (snomed_code) DO NOTHING;