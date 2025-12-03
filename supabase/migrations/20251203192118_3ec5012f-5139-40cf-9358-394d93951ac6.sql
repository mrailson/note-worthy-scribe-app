-- Batch 64: Additional Cardiovascular conditions
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description) VALUES
('49436004', 'Atrial fibrillation', 'Cardiovascular'),
('313217001', 'Paroxysmal atrial fibrillation', 'Cardiovascular'),
('440059007', 'Persistent atrial fibrillation', 'Cardiovascular'),
('426749004', 'Chronic atrial fibrillation', 'Cardiovascular'),
('195126007', 'Atrial flutter', 'Cardiovascular'),
('698247007', 'Cardiac arrhythmia', 'Cardiovascular'),
('60423000', 'Sinus bradycardia', 'Cardiovascular'),
('11092001', 'Sinus tachycardia', 'Cardiovascular'),
('233917008', 'Atrioventricular block', 'Cardiovascular'),
('27885002', 'Complete heart block', 'Cardiovascular'),
('54016002', 'Mobitz type I heart block', 'Cardiovascular'),
('28189009', 'Mobitz type II heart block', 'Cardiovascular'),
('233916004', 'Right bundle branch block', 'Cardiovascular'),
('63593006', 'Left bundle branch block', 'Cardiovascular'),
('418818005', 'Brugada syndrome', 'Cardiovascular')
ON CONFLICT (snomed_code) DO NOTHING;