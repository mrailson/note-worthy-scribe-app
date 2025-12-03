-- Batch 39: Psychiatric conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('35489007', 'Schizophrenia', 'diagnoses', 'Psychiatry'),
('13746004', 'Bipolar disorder', 'diagnoses', 'Psychiatry'),
('191736004', 'Post-traumatic stress disorder', 'diagnoses', 'Psychiatry'),
('197480006', 'Panic disorder', 'diagnoses', 'Psychiatry'),
('231504006', 'Obsessive compulsive disorder', 'diagnoses', 'Psychiatry'),
('72366004', 'Eating disorder', 'diagnoses', 'Psychiatry'),
('69482004', 'Anorexia nervosa', 'diagnoses', 'Psychiatry'),
('78004001', 'Bulimia nervosa', 'diagnoses', 'Psychiatry'),
('44376007', 'Binge eating disorder', 'diagnoses', 'Psychiatry'),
('18193002', 'Personality disorder', 'diagnoses', 'Psychiatry'),
('47505003', 'Borderline personality disorder', 'diagnoses', 'Psychiatry'),
('82023007', 'Social phobia', 'diagnoses', 'Psychiatry'),
('247500001', 'Specific phobia', 'diagnoses', 'Psychiatry'),
('70691001', 'Agoraphobia', 'diagnoses', 'Psychiatry'),
('17226007', 'Adjustment disorder', 'diagnoses', 'Psychiatry')
ON CONFLICT (snomed_code) DO NOTHING;