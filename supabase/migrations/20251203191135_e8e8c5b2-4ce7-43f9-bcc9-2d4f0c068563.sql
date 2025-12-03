-- Batch 46: Common screening and investigations
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('268547008', 'Cervical smear', 'diagnoses', 'Screening'),
('268556000', 'Bowel cancer screening', 'diagnoses', 'Screening'),
('268549006', 'Mammography', 'diagnoses', 'Screening'),
('185087000', 'NHS health check', 'diagnoses', 'Screening'),
('413095006', 'Abdominal aortic aneurysm screening', 'diagnoses', 'Screening'),
('440622007', 'Diabetic eye screening', 'diagnoses', 'Screening'),
('171207006', 'Newborn hearing screening', 'diagnoses', 'Screening'),
('428792000', 'Newborn blood spot screening', 'diagnoses', 'Screening'),
('395123002', 'Down syndrome screening', 'diagnoses', 'Screening'),
('252624004', 'Bone density scan', 'diagnoses', 'Investigation'),
('241572000', 'CT scan', 'diagnoses', 'Investigation'),
('113091000', 'MRI scan', 'diagnoses', 'Investigation'),
('16310003', 'Ultrasound scan', 'diagnoses', 'Investigation'),
('29303009', 'Electrocardiogram', 'diagnoses', 'Investigation'),
('252465000', 'Echocardiogram', 'diagnoses', 'Investigation')
ON CONFLICT (snomed_code) DO NOTHING;