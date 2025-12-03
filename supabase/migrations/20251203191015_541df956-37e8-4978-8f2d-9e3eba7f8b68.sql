-- Batch 33: More surgical procedures
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('387713003', 'Nephrectomy', 'surgeries', 'Urology'),
('116140006', 'Colectomy', 'surgeries', 'Colorectal'),
('173422009', 'Gastrectomy', 'surgeries', 'Upper GI'),
('234319005', 'Splenectomy', 'surgeries', 'General Surgery'),
('174876001', 'Laparotomy', 'surgeries', 'General Surgery'),
('13619001', 'Craniotomy', 'surgeries', 'Neurosurgery'),
('112802009', 'Laminectomy', 'surgeries', 'Neurosurgery'),
('265764009', 'Spinal fusion', 'surgeries', 'Orthopaedic'),
('287664005', 'Arthroscopy', 'surgeries', 'Orthopaedic'),
('18949003', 'Carpal tunnel release', 'surgeries', 'Orthopaedic'),
('174929003', 'Varicose vein surgery', 'surgeries', 'Vascular'),
('173136008', 'Carotid endarterectomy', 'surgeries', 'Vascular'),
('174852007', 'Angioplasty', 'surgeries', 'Cardiac'),
('175045003', 'Cardiac valve replacement', 'surgeries', 'Cardiac'),
('232717009', 'Pacemaker insertion', 'surgeries', 'Cardiac')
ON CONFLICT (snomed_code) DO NOTHING;