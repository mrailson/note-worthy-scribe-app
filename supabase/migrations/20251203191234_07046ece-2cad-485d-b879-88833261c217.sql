-- Batch 55: Common fractures
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('263102004', 'Fracture of radius', 'diagnoses', 'Orthopaedics'),
('65966004', 'Colles fracture', 'diagnoses', 'Orthopaedics'),
('359817006', 'Hip fracture', 'diagnoses', 'Orthopaedics'),
('397196006', 'Neck of femur fracture', 'diagnoses', 'Orthopaedics'),
('263225007', 'Ankle fracture', 'diagnoses', 'Orthopaedics'),
('263213000', 'Tibial fracture', 'diagnoses', 'Orthopaedics'),
('48647004', 'Vertebral fracture', 'diagnoses', 'Orthopaedics'),
('71620000', 'Rib fracture', 'diagnoses', 'Orthopaedics'),
('33737001', 'Clavicle fracture', 'diagnoses', 'Orthopaedics'),
('64859006', 'Osteoporotic fracture', 'diagnoses', 'Orthopaedics'),
('125851004', 'Stress fracture', 'diagnoses', 'Orthopaedics'),
('263109008', 'Humerus fracture', 'diagnoses', 'Orthopaedics'),
('8323008', 'Metatarsal fracture', 'diagnoses', 'Orthopaedics'),
('263109008', 'Scaphoid fracture', 'diagnoses', 'Orthopaedics'),
('431105008', 'Pelvic fracture', 'diagnoses', 'Orthopaedics')
ON CONFLICT (snomed_code) DO NOTHING;