-- Batch 59: Sleep disorders
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('193462001', 'Insomnia', 'diagnoses', 'Sleep'),
('73430006', 'Sleep apnoea', 'diagnoses', 'Sleep'),
('41975002', 'Central sleep apnoea', 'diagnoses', 'Sleep'),
('60554003', 'Narcolepsy', 'diagnoses', 'Sleep'),
('62014003', 'REM sleep behaviour disorder', 'diagnoses', 'Sleep'),
('26931000', 'Sleepwalking', 'diagnoses', 'Sleep'),
('80386000', 'Night terrors', 'diagnoses', 'Sleep'),
('62315008', 'Circadian rhythm disorder', 'diagnoses', 'Sleep'),
('228437009', 'Shift work sleep disorder', 'diagnoses', 'Sleep'),
('14168008', 'Hypersomnia', 'diagnoses', 'Sleep'),
('83420000', 'Cataplexy', 'diagnoses', 'Sleep'),
('193462001', 'Chronic fatigue syndrome', 'diagnoses', 'Sleep'),
('23406007', 'Periodic limb movement disorder', 'diagnoses', 'Sleep'),
('73430006', 'Obesity hypoventilation syndrome', 'diagnoses', 'Sleep'),
('24199005', 'Jet lag', 'diagnoses', 'Sleep')
ON CONFLICT (snomed_code) DO NOTHING;