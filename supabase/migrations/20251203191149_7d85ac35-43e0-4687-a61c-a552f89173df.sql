-- Batch 49: Spine conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('47933007', 'Lumbar disc prolapse', 'diagnoses', 'Spine'),
('263113004', 'Cervical disc prolapse', 'diagnoses', 'Spine'),
('202855006', 'Cervical spondylosis', 'diagnoses', 'Spine'),
('239873007', 'Lumbar spondylosis', 'diagnoses', 'Spine'),
('76107001', 'Spinal stenosis', 'diagnoses', 'Spine'),
('202855006', 'Sciatica', 'diagnoses', 'Spine'),
('239872002', 'Cauda equina syndrome', 'diagnoses', 'Spine'),
('23406007', 'Kyphosis', 'diagnoses', 'Spine'),
('55300003', 'Lordosis', 'diagnoses', 'Spine'),
('239873007', 'Cervical radiculopathy', 'diagnoses', 'Spine'),
('202855006', 'Lumbar radiculopathy', 'diagnoses', 'Spine'),
('239872002', 'Mechanical back pain', 'diagnoses', 'Spine'),
('77386006', 'Sacroiliac joint dysfunction', 'diagnoses', 'Spine'),
('202855006', 'Facet joint syndrome', 'diagnoses', 'Spine'),
('125661000119100', 'Degenerative disc disease', 'diagnoses', 'Spine')
ON CONFLICT (snomed_code) DO NOTHING;